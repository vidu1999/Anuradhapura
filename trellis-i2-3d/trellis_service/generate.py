"""The TRELLIS image → 3D generation step.

Deliberately thin: it calls the vendored pipeline in exactly the order that
``TrellisImageTo3DPipeline.run`` does, but keeps the stages separate so the
service can report progress between them and export the result as GLB.

    sparse structure  →  structured latent (SLAT)  →  mesh + gaussian decode
                                                       →  GLB (textured mesh)

Nothing here re-implements TRELLIS: every tensor, sampler and post-processing
call comes from ``vendor/TRELLIS``.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional

from .progress import Progress


@dataclass
class GenOptions:
    seed: int = 42
    ss_steps: int = 12
    ss_cfg: float = 7.5
    slat_steps: int = 12
    slat_cfg: float = 3.0
    simplify: float = 0.95
    texture_size: int = 1024
    export_ply: bool = False
    export_preview: bool = False

    @classmethod
    def from_mapping(cls, data: dict[str, Any], defaults: "GenOptions | None" = None) -> "GenOptions":
        base = defaults or cls()
        opts = cls()
        for field_name, value in asdict(base).items():
            setattr(opts, field_name, value)
        for field_name in asdict(opts):
            if field_name not in data or data[field_name] in (None, ""):
                continue
            current = getattr(opts, field_name)
            if isinstance(current, bool):
                setattr(opts, field_name, bool(data[field_name]))
            elif isinstance(current, int):
                setattr(opts, field_name, int(float(data[field_name])))
            elif isinstance(current, float):
                setattr(opts, field_name, float(data[field_name]))
            else:
                setattr(opts, field_name, data[field_name])
        return opts


@dataclass
class GenResult:
    files: dict[str, str]
    stats: dict[str, Any]

    def to_dict(self) -> dict:
        return {"files": self.files, "stats": self.stats}


def _require_torch():
    import torch  # imported lazily: the marketing pages / mock backend must not need it

    return torch


def run_trellis(
    pipeline,
    image,
    options: GenOptions,
    progress: Progress,
    work_dir: Path,
) -> GenResult:
    """Run the vendored TRELLIS pipeline on one PIL image and export a GLB."""
    torch = _require_torch()
    from trellis.utils import postprocessing_utils

    work_dir.mkdir(parents=True, exist_ok=True)
    timings: dict[str, float] = {}
    started = time.perf_counter()

    # ---- 1. preprocess ---------------------------------------------------
    progress.begin("preprocess", 0.02, 0.07, "removing background / normalising the image")
    t0 = time.perf_counter()
    with progress.capture_output():
        prepped = pipeline.preprocess_image(image)
    prepped_path = work_dir / "input_518.png"
    prepped.save(prepped_path)
    timings["preprocess"] = round(time.perf_counter() - t0, 3)

    # ---- 2. sparse structure --------------------------------------------
    progress.begin("sparse structure", 0.07, 0.45, "sampling the sparse structure (geometry)")
    t0 = time.perf_counter()
    with progress.capture_output():
        with torch.no_grad():
            cond = pipeline.get_cond([prepped])
            torch.manual_seed(options.seed)
            coords = pipeline.sample_sparse_structure(
                cond,
                1,
                {"steps": options.ss_steps, "cfg_strength": options.ss_cfg},
            )
    voxels = int(coords.shape[0])
    timings["sparse_structure"] = round(time.perf_counter() - t0, 3)

    # ---- 3. structured latent -------------------------------------------
    progress.begin("structured latent", 0.45, 0.82, "sampling the SLAT (appearance)")
    t0 = time.perf_counter()
    with progress.capture_output():
        with torch.no_grad():
            slat = pipeline.sample_slat(
                cond,
                coords,
                {"steps": options.slat_steps, "cfg_strength": options.slat_cfg},
            )
    timings["structured_latent"] = round(time.perf_counter() - t0, 3)

    # ---- 4. decode -------------------------------------------------------
    progress.begin("decode", 0.82, 0.90, "decoding mesh + gaussians")
    t0 = time.perf_counter()
    with progress.capture_output():
        with torch.no_grad():
            outputs = pipeline.decode_slat(slat, ["mesh", "gaussian"])
    timings["decode"] = round(time.perf_counter() - t0, 3)

    mesh = outputs["mesh"][0]
    gaussian = outputs["gaussian"][0]
    faces = int(mesh.faces.shape[0])

    # ---- 5. GLB ----------------------------------------------------------
    progress.begin("export glb", 0.90, 0.99, "uv-unwrapping, baking texture, writing GLB")
    t0 = time.perf_counter()
    glb_path = work_dir / "model.glb"
    with progress.capture_output():
        glb = postprocessing_utils.to_glb(
            gaussian,
            mesh,
            simplify=options.simplify,
            texture_size=options.texture_size,
            verbose=False,
        )
        glb.export(glb_path)
    timings["export_glb"] = round(time.perf_counter() - t0, 3)

    files = {"glb": str(glb_path), "preprocessed": str(prepped_path)}

    # ---- 6. optional extras ---------------------------------------------
    if options.export_ply:
        progress.begin("export ply", 0.99, 0.995, "writing gaussian splat PLY")
        ply_path = work_dir / "model.ply"
        gaussian.save_ply(str(ply_path))
        files["ply"] = str(ply_path)

    if options.export_preview:
        progress.begin("render preview", 0.99, 0.999, "rendering a turntable")
        try:
            from trellis.utils import render_utils

            video = render_utils.render_video(gaussian)["color"]
            if video:
                from PIL import Image as PILImage

                preview = work_dir / "preview.png"
                PILImage.fromarray(video[len(video) // 4]).save(preview)
                files["preview"] = str(preview)
        except Exception as exc:  # a missing preview must not fail a good model
            progress.append(f"preview render skipped: {exc}")

    timings["total"] = round(time.perf_counter() - started, 3)

    stats = {
        "backend": "trellis",
        "seed": options.seed,
        "sampler": {
            "sparse_structure": {"steps": options.ss_steps, "cfg_strength": options.ss_cfg},
            "structured_latent": {"steps": options.slat_steps, "cfg_strength": options.slat_cfg},
        },
        "voxels": voxels,
        "mesh_faces": faces,
        "texture_size": options.texture_size,
        "simplify": options.simplify,
        "timings": timings,
    }
    (work_dir / "meta.json").write_text(json.dumps(stats, indent=2))
    return GenResult(files=files, stats=stats)
