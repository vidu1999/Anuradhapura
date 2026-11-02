"""GPU-free smoke-test backend.

This is **not** a 3D reconstruction and makes no claim to be one: it wraps the
uploaded image around a sphere so that the upload → job → GLB → viewer path can
be exercised (and tested in CI) without an NVIDIA GPU.

Everything it produces is labelled ``backend: "mock"`` so it can never be
confused with a real TRELLIS result.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from PIL import Image

from .generate import GenOptions, GenResult
from .progress import Progress


def run_mock(
    image,
    options: GenOptions,
    progress: Progress,
    work_dir: Path,
    reason: str = "",
) -> GenResult:
    import numpy as np
    import trimesh

    work_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()

    progress.begin("preprocess", 0.05, 0.2, "preparing the image (smoke test)")
    square = image.convert("RGBA")
    side = max(square.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(square, ((side - square.width) // 2, (side - square.height) // 2))
    canvas = canvas.resize((512, 512), Image.LANCZOS)
    prepped_path = work_dir / "preprocessed.png"
    canvas.save(prepped_path)

    progress.begin("placeholder mesh", 0.2, 0.75, "building the smoke-test mesh")
    sphere = trimesh.creation.icosphere(subdivisions=4, radius=1.0)
    vertices = np.asarray(sphere.vertices)
    x, y, z = vertices[:, 0], vertices[:, 1], vertices[:, 2]
    u = 0.5 + np.arctan2(z, x) / (2 * np.pi)
    v = 0.5 - np.arcsin(np.clip(y, -1, 1)) / np.pi
    uv = np.stack([u, v], axis=1)
    sphere.visual = trimesh.visual.TextureVisuals(
        uv=uv,
        material=trimesh.visual.material.PBRMaterial(
            baseColorTexture=canvas.convert("RGB"),
            metallicFactor=0.0,
            roughnessFactor=0.85,
        ),
    )

    progress.begin("export glb", 0.75, 0.98, "writing GLB (smoke test)")
    glb_path = work_dir / "model.glb"
    sphere.export(glb_path)

    timings = {"total": round(time.perf_counter() - started, 3)}
    stats = {
        "backend": "mock",
        "mock_reason": reason or "GPU-free smoke-test backend",
        "seed": options.seed,
        "voxels": int(len(sphere.vertices)),
        "mesh_faces": int(len(sphere.faces)),
        "texture_size": 512,
        "simplify": options.simplify,
        "timings": timings,
        "disclaimer": (
            "Smoke-test output: a placeholder sphere textured with your upload. "
            "Run the service on a CUDA GPU to generate a real TRELLIS reconstruction."
        ),
    }
    (work_dir / "meta.json").write_text(json.dumps(stats, indent=2))
    return GenResult(files={"glb": str(glb_path), "preprocessed": str(prepped_path)}, stats=stats)
