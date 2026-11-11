"""Configuration for the TRELLIS image-to-3D service.

Everything is overridable with environment variables so the same image can run
on a laptop with a single GPU, in a container, or in a cluster.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
VENDOR_TRELLIS = SERVICE_ROOT / "vendor" / "TRELLIS"


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return default if value is None or value == "" else value


def _env_int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(_env(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    """Runtime configuration (immutable; build with :func:`load_settings`)."""

    # ---- model -----------------------------------------------------------
    #: Hugging Face id (``microsoft/TRELLIS-image-large``) or a local directory
    #: produced by ``scripts/fetch_weights.py``.
    model: str = "microsoft/TRELLIS-image-large"
    #: ``cuda``, ``cuda:0``, ... TRELLIS requires an NVIDIA GPU.
    device: str = "cuda"
    #: ``flash-attn`` (default upstream) or ``xformers`` for older GPUs.
    attn_backend: str = "flash-attn"
    #: ``native`` avoids spconv's start-up benchmark — recommended for a service.
    spconv_algo: str = "native"

    #: ``auto`` | ``trellis`` | ``mock``.  ``auto`` uses TRELLIS when CUDA and
    #: the vendored code are importable, and otherwise falls back to the
    #: GPU-free smoke-test backend so the interface can still be exercised.
    backend: str = "auto"

    # ---- generation defaults --------------------------------------------
    seed: int = 42
    ss_steps: int = 12
    ss_cfg: float = 7.5
    slat_steps: int = 12
    slat_cfg: float = 3.0
    simplify: float = 0.95
    texture_size: int = 1024

    # ---- service ---------------------------------------------------------
    output_dir: Path = field(default_factory=lambda: SERVICE_ROOT / "outputs")
    weights_dir: Path = field(default_factory=lambda: SERVICE_ROOT / "weights")
    max_upload_mb: int = 20
    job_ttl_s: int = 60 * 60
    max_concurrent_jobs: int = 1
    host: str = "0.0.0.0"
    port: int = 8100

    @property
    def vendor_trellis(self) -> Path:
        return VENDOR_TRELLIS

    def describe(self) -> dict:
        return {
            "model": self.model,
            "device": self.device,
            "attn_backend": self.attn_backend,
            "spconv_algo": self.spconv_algo,
            "backend_requested": self.backend,
            "output_dir": str(self.output_dir),
            "max_upload_mb": self.max_upload_mb,
        }


def load_settings() -> Settings:
    """Read the environment over a freshly built set of defaults."""
    d = Settings()
    return Settings(
        model=_env("TRELLIS_MODEL", d.model),
        device=_env("TRELLIS_DEVICE", d.device),
        attn_backend=_env("ATTN_BACKEND", d.attn_backend),
        spconv_algo=_env("SPCONV_ALGO", d.spconv_algo),
        backend=_env("TRELLIS_BACKEND", d.backend),
        seed=_env_int("TRELLIS_SEED", d.seed),
        ss_steps=_env_int("TRELLIS_SS_STEPS", d.ss_steps),
        ss_cfg=_env_float("TRELLIS_SS_CFG", d.ss_cfg),
        slat_steps=_env_int("TRELLIS_SLAT_STEPS", d.slat_steps),
        slat_cfg=_env_float("TRELLIS_SLAT_CFG", d.slat_cfg),
        simplify=_env_float("TRELLIS_SIMPLIFY", d.simplify),
        texture_size=_env_int("TRELLIS_TEXTURE_SIZE", d.texture_size),
        output_dir=Path(_env("TRELLIS_OUTPUT_DIR", str(d.output_dir))),
        weights_dir=Path(_env("TRELLIS_WEIGHTS_DIR", str(d.weights_dir))),
        max_upload_mb=_env_int("TRELLIS_MAX_UPLOAD_MB", d.max_upload_mb),
        job_ttl_s=_env_int("TRELLIS_JOB_TTL_S", d.job_ttl_s),
        max_concurrent_jobs=_env_int("TRELLIS_MAX_CONCURRENT", d.max_concurrent_jobs),
        host=_env("TRELLIS_HOST", d.host),
        port=_env_int("TRELLIS_PORT", d.port),
    )
