"""Backend selection and the (lazy) TRELLIS pipeline handle.

The service can only do real work on a CUDA machine, but it must still start —
and be usable — on a CPU box.  So the backend is resolved once at start-up:

* ``trellis`` — CUDA + the vendored code are importable; the pipeline is loaded
  on first request (loading ~2 B parameters takes a while, and doing it lazily
  keeps the health check instant).
* ``mock``    — GPU-free smoke-test backend: proves the upload → job → GLB →
  viewer path end to end, and is clearly labelled in the UI.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .config import Settings
from .generate import GenOptions, GenResult, run_trellis
from .progress import Progress


class BackendUnavailable(RuntimeError):
    """Raised when the requested backend cannot serve a request."""


@dataclass
class Probe:
    """What the machine can do — surfaced by ``GET /api/health``."""

    backend: str = "unknown"
    reason: str = ""
    device: str = "cpu"
    gpu: Optional[str] = None
    vram_gb: Optional[float] = None
    torch: Optional[str] = None
    cuda: Optional[str] = None
    trellis_importable: bool = False
    model: str = ""
    pipeline_loaded: bool = False
    load_seconds: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "backend": self.backend,
            "reason": self.reason,
            "device": self.device,
            "gpu": self.gpu,
            "vram_gb": self.vram_gb,
            "torch": self.torch,
            "cuda": self.cuda,
            "trellis_importable": self.trellis_importable,
            "model": self.model,
            "pipeline_loaded": self.pipeline_loaded,
            "load_seconds": self.load_seconds,
        }


def _prepare_environment(settings: Settings) -> None:
    """Set the upstream environment knobs *before* torch / spconv are imported."""
    os.environ.setdefault("ATTN_BACKEND", settings.attn_backend)
    os.environ.setdefault("SPCONV_ALGO", settings.spconv_algo)
    if str(settings.vendor_trellis) not in sys.path:
        sys.path.insert(0, str(settings.vendor_trellis))
    # Keep the Hugging Face cache inside the container when asked to.
    cache = os.environ.get("TRELLIS_HF_HOME")
    if cache:
        os.environ.setdefault("HF_HOME", cache)


def probe(settings: Settings) -> Probe:
    """Inspect the machine without importing all of torch's friends."""
    result = Probe(model=settings.model)
    _prepare_environment(settings)

    try:
        import torch

        result.torch = torch.__version__
        result.cuda = torch.version.cuda or None
        if torch.cuda.is_available():
            index = 0
            if ":" in settings.device:
                try:
                    index = int(settings.device.split(":", 1)[1])
                except ValueError:
                    index = 0
            result.gpu = torch.cuda.get_device_name(index)
            props = torch.cuda.get_device_properties(index)
            result.vram_gb = round(props.total_memory / 1024**3, 1)
            result.device = f"cuda:{index}"
        else:
            result.reason = "torch reports no CUDA device"
    except Exception as exc:  # torch missing entirely
        result.reason = f"torch unavailable ({exc.__class__.__name__}: {exc})"

    try:
        import trellis  # noqa: F401  (vendored on sys.path)

        result.trellis_importable = True
    except Exception as exc:
        result.reason = (result.reason + "; " if result.reason else "") + (
            f"trellis import failed ({exc.__class__.__name__}: {exc})"
        )

    requested = settings.backend
    can_trellis = bool(result.gpu) and result.trellis_importable
    if requested == "mock":
        result.backend = "mock"
        result.reason = result.reason or "mock backend requested"
    elif requested == "trellis":
        result.backend = "trellis"
        if not can_trellis:
            result.reason = result.reason or "trellis backend requested but unavailable"
    else:  # auto
        result.backend = "trellis" if can_trellis else "mock"
        if not can_trellis and not result.reason:
            result.reason = "falling back to the smoke-test backend"

    if result.backend == "mock" and not result.reason:
        result.reason = "GPU-free smoke-test backend"
    return result


class TrellisRuntime:
    """Owns the single TRELLIS pipeline instance for the process."""

    def __init__(self, settings: Settings, probe_result: Probe | None = None):
        self.settings = settings
        self.probe = probe_result or probe(settings)
        self._pipeline = None
        self._load_lock = threading.Lock()
        self._generate_lock = threading.Lock()

    # -- capability --------------------------------------------------------
    @property
    def backend(self) -> str:
        return self.probe.backend

    @property
    def ready(self) -> bool:
        return self.backend == "mock" or self._pipeline is not None

    # -- pipeline ----------------------------------------------------------
    def load(self) -> Optional[Any]:
        """Load the pipeline once.  Returns ``None`` for the mock backend."""
        if self.backend == "mock":
            return None
        if self._pipeline is not None:
            return self._pipeline
        with self._load_lock:
            if self._pipeline is not None:
                return self._pipeline
            if not self.probe.trellis_importable or not self.probe.gpu:
                raise BackendUnavailable(self.probe.reason or "no CUDA device")

            from trellis.pipelines import TrellisImageTo3DPipeline

            started = time.perf_counter()
            pipeline = TrellisImageTo3DPipeline.from_pretrained(self.settings.model)
            pipeline.cuda()
            self._pipeline = pipeline
            self.probe.pipeline_loaded = True
            self.probe.load_seconds = round(time.perf_counter() - started, 1)
            return self._pipeline

    # -- generation --------------------------------------------------------
    def generate(
        self,
        image,
        options: GenOptions,
        progress: Progress,
        work_dir: Path,
    ) -> GenResult:
        if self.backend == "mock":
            from .mock import run_mock

            return run_mock(image, options, progress, work_dir, reason=self.probe.reason)

        pipeline = self.load()
        # TRELLIS keeps mutable sampler state; one job at a time keeps it honest.
        with self._generate_lock:
            return run_trellis(pipeline, image, options, progress, work_dir)


def build_runtime(settings: Settings) -> TrellisRuntime:
    return TrellisRuntime(settings, probe(settings))
