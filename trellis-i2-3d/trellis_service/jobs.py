"""A small in-process job store.

Generating a 3D asset takes tens of seconds on a GPU, so the HTTP API is
asynchronous: ``POST /api/generate`` returns a job id, the client polls
``GET /api/jobs/{id}``.  One worker thread is used because a single GPU can only
run one TRELLIS job at a time with any semblance of efficiency.
"""

from __future__ import annotations

import io
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from .generate import GenOptions, GenResult
from .progress import Progress
from .runtime import TrellisRuntime


@dataclass
class Job:
    id: str
    filename: str
    options: GenOptions
    status: str = "queued"          # queued | running | succeeded | failed
    stage: str = "queued"
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    files: dict[str, str] = field(default_factory=dict)     # kind -> absolute path
    stats: dict[str, Any] = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    @property
    def work_dir(self) -> Path | None:
        raw = self.files.get("_work_dir") or ""
        return Path(raw) if raw else None

    def public(self) -> dict:
        """JSON-safe view, with output files expressed as API URLs."""
        return {
            "id": self.id,
            "status": self.status,
            "stage": self.stage,
            "progress": round(self.progress, 4),
            "message": self.message,
            "error": self.error,
            "filename": self.filename,
            "options": {
                "seed": self.options.seed,
                "ss_steps": self.options.ss_steps,
                "ss_cfg": self.options.ss_cfg,
                "slat_steps": self.options.slat_steps,
                "slat_cfg": self.options.slat_cfg,
                "simplify": self.options.simplify,
                "texture_size": self.options.texture_size,
            },
            "files": {
                kind: f"/api/outputs/{self.id}/{Path(path).name}"
                for kind, path in self.files.items()
                if not kind.startswith("_")
            },
            "stats": self.stats,
            "timings": {
                "created_at": self.created_at,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "queue_seconds": round((self.started_at or time.time()) - self.created_at, 2),
                "run_seconds": round((self.finished_at or time.time()) - (self.started_at or time.time()), 2)
                if self.started_at
                else None,
            },
            "log": self.log[-60:],
        }


class JobStore:
    def __init__(self, runtime: TrellisRuntime, output_dir: Path, ttl_s: int = 3600, workers: int = 1):
        self.runtime = runtime
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ttl_s = ttl_s
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=max(1, workers), thread_name_prefix="trellis")
        self._sweeper = threading.Thread(target=self._sweep_loop, daemon=True)
        self._stop = threading.Event()
        self._sweeper.start()

    # -- lifecycle ---------------------------------------------------------
    def shutdown(self) -> None:
        self._stop.set()
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _sweep_loop(self) -> None:
        while not self._stop.wait(60):
            cutoff = time.time() - self.ttl_s
            with self._lock:
                stale = [j for j in self._jobs.values() if j.finished_at and j.finished_at < cutoff]
            for job in stale:
                self.delete(job.id)

    # -- API ---------------------------------------------------------------
    def create(self, filename: str, options: GenOptions) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(id=job_id, filename=filename, options=options)
        job.files["_work_dir"] = str(self.output_dir / job_id)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self, limit: int = 50) -> list[Job]:
        with self._lock:
            jobs = sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)
        return jobs[:limit]

    def delete(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.pop(job_id, None)
        if not job:
            return False
        work_dir = job.work_dir
        # Never delete anything that is not a per-job directory inside outputs/.
        safe = (
            work_dir is not None
            and work_dir.is_dir()
            and work_dir.parent.resolve() == self.output_dir.resolve()
            and work_dir.name == job.id
        )
        if safe:
            for child in sorted(work_dir.rglob("*"), reverse=True):
                try:
                    child.unlink() if child.is_file() else child.rmdir()
                except OSError:
                    pass
            try:
                work_dir.rmdir()
            except OSError:
                pass
        return True

    # -- execution ---------------------------------------------------------
    def submit(self, job: Job, image_bytes: bytes) -> None:
        self._pool.submit(self._run, job, image_bytes)

    def _run(self, job: Job, image_bytes: bytes) -> None:
        from PIL import Image

        job.status = "running"
        job.started_at = time.time()

        def on_progress(value: float, stage: str) -> None:
            job.progress = value
            job.stage = stage

        progress = Progress(callback=on_progress, log_lines=600)
        work_dir = Path(job.files["_work_dir"])

        try:
            progress.begin("preprocess", 0.0, 0.02, f"received {job.filename}")
            with Image.open(io.BytesIO(image_bytes)) as handle:
                image = handle.convert("RGBA")
            job.files["upload"] = str(work_dir / "upload.png")
            work_dir.mkdir(parents=True, exist_ok=True)
            image.save(job.files["upload"])

            result: GenResult = self.runtime.generate(image, job.options, progress, work_dir)

            job.files.update(result.files)
            job.stats = result.stats
            job.status = "succeeded"
            job.message = "model ready"
            progress.finish()
        except Exception as exc:  # surface the real message to the client
            job.status = "failed"
            job.error = f"{exc.__class__.__name__}: {exc}"
            job.message = "generation failed"
            job.stage = "failed"
            progress.append(job.error)
        finally:
            job.finished_at = time.time()
            job.progress = 1.0 if job.status == "succeeded" else job.progress
            job.log = list(progress.log)
