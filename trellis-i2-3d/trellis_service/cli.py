"""Command line entry point.

    python -m trellis_service.cli photo.jpg --out outputs/my-model
    python -m trellis_service.cli photo.jpg --out out/ --seed 7 --texture-size 2048 --ply

Prints progress on stderr and a JSON summary on stdout, so it composes with
shell scripts and pipelines.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

from .config import load_settings
from .generate import GenOptions
from .progress import Progress
from .runtime import TrellisRuntime, probe


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="trellis-image-to-3d",
        description="Generate a textured GLB from a single image with microsoft/TRELLIS.",
    )
    p.add_argument("image", type=Path, help="input image (png/jpg/webp)")
    p.add_argument("--out", type=Path, required=True, help="output directory for the GLB")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--ss-steps", type=int, default=None, help="sparse-structure sampler steps")
    p.add_argument("--ss-cfg", type=float, default=None)
    p.add_argument("--slat-steps", type=int, default=None, help="structured-latent sampler steps")
    p.add_argument("--slat-cfg", type=float, default=None)
    p.add_argument("--simplify", type=float, default=None, help="fraction of faces to remove (0..1)")
    p.add_argument("--texture-size", type=int, default=None)
    p.add_argument("--ply", action="store_true", help="also write the gaussian splat PLY")
    p.add_argument("--preview", action="store_true", help="also render one preview frame")
    p.add_argument("--backend", choices=["auto", "trellis", "mock"], default=None)
    p.add_argument("--model", default=None, help="HF id or local weights directory")
    p.add_argument("--json", action="store_true", help="machine-readable output only")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if not args.image.exists():
        print(f"error: {args.image} does not exist", file=sys.stderr)
        return 2

    base = load_settings()
    settings = base.__class__(
        **{
            **base.__dict__,
            "backend": args.backend or base.backend,
            "model": args.model or base.model,
        }
    )

    runtime = TrellisRuntime(settings, probe(settings))
    if runtime.backend == "trellis" and (not runtime.probe.gpu or not runtime.probe.trellis_importable):
        print(f"error: TRELLIS backend unavailable — {runtime.probe.reason}", file=sys.stderr)
        return 3
    if runtime.backend == "mock" and not args.json:
        print(
            f"! smoke-test backend ({runtime.probe.reason}); "
            "the GLB will be a placeholder, not a reconstruction",
            file=sys.stderr,
        )

    options = GenOptions(
        seed=args.seed if args.seed is not None else settings.seed,
        ss_steps=args.ss_steps if args.ss_steps is not None else settings.ss_steps,
        ss_cfg=args.ss_cfg if args.ss_cfg is not None else settings.ss_cfg,
        slat_steps=args.slat_steps if args.slat_steps is not None else settings.slat_steps,
        slat_cfg=args.slat_cfg if args.slat_cfg is not None else settings.slat_cfg,
        simplify=args.simplify if args.simplify is not None else settings.simplify,
        texture_size=args.texture_size if args.texture_size is not None else settings.texture_size,
        export_ply=args.ply,
        export_preview=args.preview,
    )

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    last = {"line": ""}

    def on_progress(value: float, stage: str) -> None:
        line = f"[{value * 100:5.1f}%] {stage}"
        if line != last["line"] and not args.json:
            print(line, file=sys.stderr, flush=True)
            last["line"] = line

    progress = Progress(callback=on_progress)
    started = time.time()

    from PIL import Image

    with Image.open(args.image) as handle:
        image = handle.convert("RGBA")

    try:
        result = runtime.generate(image, options, progress, out_dir)
    except Exception as exc:
        print(f"error: {exc.__class__.__name__}: {exc}", file=sys.stderr)
        for line in list(progress.log)[-15:]:
            print(f"  {line}", file=sys.stderr)
        return 1

    # The runtime writes into out_dir directly; make sure a canonical name exists.
    glb_src = Path(result.files["glb"])
    glb_dst = out_dir / "model.glb"
    if glb_src.resolve() != glb_dst.resolve():
        shutil.copy2(glb_src, glb_dst)

    summary = {
        "ok": True,
        "backend": result.stats.get("backend"),
        "glb": str(glb_dst),
        "files": {k: str(v) for k, v in result.files.items()},
        "stats": result.stats,
        "seconds": round(time.time() - started, 1),
        "input": str(args.image),
    }
    if not args.json:
        print(
            f"\nwrote {glb_dst}  ({glb_dst.stat().st_size / 1024:.0f} kB, "
            f"{result.stats.get('mesh_faces', '?'):,} faces)",
            file=sys.stderr,
        )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
