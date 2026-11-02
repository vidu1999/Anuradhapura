"""FastAPI surface for the TRELLIS image-to-3D service.

    GET  /api/health              backend + device + model status
    POST /api/generate            multipart upload → {"id": ...}
    GET  /api/jobs/{id}           job status, progress, log, output URLs
    GET  /api/jobs                recent jobs
    DELETE /api/jobs/{id}         delete a job and its files
    GET  /api/outputs/{id}/{name} download a generated file
    GET  /                        the web interface
"""

from __future__ import annotations

import io
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import SERVICE_ROOT, Settings, load_settings
from .generate import GenOptions
from .jobs import JobStore
from .runtime import TrellisRuntime, probe

WEB_DIR = SERVICE_ROOT / "web"

ALLOWED_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def create_app(settings: Optional[Settings] = None, runtime: Optional[TrellisRuntime] = None) -> FastAPI:
    settings = settings or load_settings()
    runtime = runtime or TrellisRuntime(settings, probe(settings))
    store = JobStore(
        runtime,
        settings.output_dir,
        ttl_s=settings.job_ttl_s,
        workers=settings.max_concurrent_jobs,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Warm the pipeline in the background so the first real request is not
        # also paying for a multi-gigabyte checkpoint load.
        if runtime.backend == "trellis":
            import threading

            threading.Thread(target=_safe_load, args=(runtime,), daemon=True).start()
        yield
        store.shutdown()

    app = FastAPI(
        title="TRELLIS image → 3D",
        description=(
            "Image-to-3D asset generation powered entirely by microsoft/TRELLIS. "
            "Upload one image, get a textured GLB."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.runtime = runtime
    app.state.store = store

    # ---- API -------------------------------------------------------------
    @app.get("/api/health")
    def health() -> dict:
        return {
            "ok": True,
            "service": "trellis-image-to-3d",
            "backend": runtime.backend,
            "ready": runtime.ready,
            "status": runtime.probe.to_dict(),
            "defaults": {
                "seed": settings.seed,
                "ss_steps": settings.ss_steps,
                "ss_cfg": settings.ss_cfg,
                "slat_steps": settings.slat_steps,
                "slat_cfg": settings.slat_cfg,
                "simplify": settings.simplify,
                "texture_size": settings.texture_size,
            },
            "limits": {"max_upload_mb": settings.max_upload_mb},
        }

    @app.post("/api/generate", status_code=202)
    async def generate(
        request: Request,
        image: UploadFile = File(..., description="One image of the object"),
        seed: Optional[int] = Form(None),
        ss_steps: Optional[int] = Form(None),
        ss_cfg: Optional[float] = Form(None),
        slat_steps: Optional[int] = Form(None),
        slat_cfg: Optional[float] = Form(None),
        simplify: Optional[float] = Form(None),
        texture_size: Optional[int] = Form(None),
        export_ply: Optional[bool] = Form(None),
        export_preview: Optional[bool] = Form(None),
    ) -> dict:
        suffix = Path(image.filename or "").suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise HTTPException(
                status_code=415,
                detail=f"unsupported image type {suffix or '(none)'}; use one of {sorted(ALLOWED_SUFFIXES)}",
            )

        payload = await image.read()
        limit = settings.max_upload_mb * 1024 * 1024
        if not payload:
            raise HTTPException(status_code=400, detail="empty upload")
        if len(payload) > limit:
            raise HTTPException(
                status_code=413, detail=f"image is larger than {settings.max_upload_mb} MB"
            )

        # Fail fast on a corrupt file rather than inside a worker thread.
        from PIL import Image

        try:
            with Image.open(io.BytesIO(payload)) as handle:
                handle.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="the upload is not a readable image")

        defaults = GenOptions(
            seed=settings.seed,
            ss_steps=settings.ss_steps,
            ss_cfg=settings.ss_cfg,
            slat_steps=settings.slat_steps,
            slat_cfg=settings.slat_cfg,
            simplify=settings.simplify,
            texture_size=settings.texture_size,
        )
        supplied = {
            "seed": seed,
            "ss_steps": ss_steps,
            "ss_cfg": ss_cfg,
            "slat_steps": slat_steps,
            "slat_cfg": slat_cfg,
            "simplify": simplify,
            "texture_size": texture_size,
            "export_ply": export_ply,
            "export_preview": export_preview,
        }
        options = GenOptions.from_mapping({k: v for k, v in supplied.items() if v is not None}, defaults)

        if runtime.backend == "trellis" and not runtime.probe.trellis_importable:
            raise HTTPException(status_code=503, detail=runtime.probe.reason)
        if runtime.backend == "trellis" and not runtime.probe.gpu:
            raise HTTPException(status_code=503, detail=runtime.probe.reason or "no CUDA device")

        job = store.create(image.filename or "upload.png", options)
        store.submit(job, payload)
        return {"id": job.id, "status": job.status, "jobs_url": f"/api/jobs/{job.id}"}

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str) -> dict:
        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="unknown job")
        return job.public()

    @app.get("/api/jobs")
    def jobs_list(limit: int = 20) -> dict:
        return {"jobs": [job.public() for job in store.list(limit)]}

    @app.delete("/api/jobs/{job_id}")
    def job_delete(job_id: str) -> dict:
        if not store.delete(job_id):
            raise HTTPException(status_code=404, detail="unknown job")
        return {"deleted": job_id}

    @app.get("/api/outputs/{job_id}/{filename}")
    def output(job_id: str, filename: str) -> FileResponse:
        job = store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="unknown job")
        if Path(filename).name != filename:  # no traversal
            raise HTTPException(status_code=400, detail="bad filename")
        work_dir = job.work_dir
        if work_dir is None:
            raise HTTPException(status_code=404, detail="unknown output")
        target = work_dir / filename
        if not target.is_file():
            raise HTTPException(status_code=404, detail="unknown output")
        media = {
            ".glb": "model/gltf-binary",
            ".ply": "application/octet-stream",
            ".png": "image/png",
            ".json": "application/json",
        }.get(target.suffix.lower(), "application/octet-stream")
        return FileResponse(target, media_type=media, filename=filename)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    # ---- UI --------------------------------------------------------------
    if WEB_DIR.is_dir():
        app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")

    return app


def _safe_load(runtime: TrellisRuntime) -> None:
    try:
        runtime.load()
    except Exception as exc:  # keep the service up; requests will report it
        runtime.probe.reason = f"pipeline load failed: {exc}"


app = create_app()
