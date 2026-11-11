#!/usr/bin/env python3
"""
make_comparison.py
==================
Renders the exported model from the same viewpoint as the uploaded photograph
and lays the two side by side, aligned on two measured points:

    finial tip       → (1024, 169)  in the photo
    elephant plinth  → (1024, 1790) in the photo

Because both the camera and the two calibration points are explicit, the
comparison is a genuine test of the model's proportions rather than a
decorative montage.

    python3 tools/make_comparison.py
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from preview_render import look_at, perspective  # noqa: E402

PHOTO = ROOT / "assets" / "source" / "ruwanwelisaya.jpg"
OUT = ROOT / "docs" / "comparison.jpg"
TMP = Path("/tmp/ruwanwelisaya_match.png")

# measured in the 2048x2048 photograph
TIP_PX = (1024.0, 169.0)
BASE_PX = (1024.0, 1790.0)

# viewpoint chosen to match the photograph's long lens and low camera
EYE = (0.0, 6.0, 760.0)
TARGET = (0.0, 44.0, 0.0)
FOV = 9.4
SIZE = 1400

# model landmarks (metres)
TIP = (0.0, 90.2, 0.0)        # finial tip
BASE = (0.0, 0.0, 57.8)       # foot of the elephant wall, near side


def project(point, eye, target, fov, size):
    view = look_at(eye, target)
    proj = perspective(fov, 1.0)
    v = np.array([point[0], point[1], point[2], 1.0])
    clip = proj @ view @ v
    ndc = clip[:3] / clip[3]
    x = (ndc[0] * 0.5 + 0.5) * size
    y = (1 - (ndc[1] * 0.5 + 0.5)) * size
    return np.array([x, y])


def main() -> None:
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools" / "preview_render.py"),
            "--out",
            str(TMP),
            "--size",
            f"{SIZE}x{SIZE}",
            f"--cam={EYE[0]},{EYE[1]},{EYE[2]}",
            f"--look={TARGET[0]},{TARGET[1]},{TARGET[2]}",
            "--fov",
            str(FOV),
        ],
        check=True,
    )

    render = Image.open(TMP).convert("RGB")
    p_tip = project(TIP, EYE, TARGET, FOV, SIZE)
    p_base = project(BASE, EYE, TARGET, FOV, SIZE)
    print("projected tip ", p_tip)
    print("projected base", p_base)

    photo = Image.open(PHOTO).convert("RGB")
    canvas = Image.new("RGB", photo.size, (18, 26, 36))

    photo_span = BASE_PX[1] - TIP_PX[1]
    render_span = p_base[1] - p_tip[1]
    scale = photo_span / render_span
    print(f"scale {scale:.4f}")

    if abs(scale - 1.0) > 1e-6:
        render = render.resize(
            (int(round(SIZE * scale)), int(round(SIZE * scale))), Image.LANCZOS
        )

    # translate so the tip lands on TIP_PX (and the base follows automatically)
    dx = TIP_PX[0] - p_tip[0] * scale
    dy = TIP_PX[1] - p_tip[1] * scale
    canvas.paste(render, (int(round(dx)), int(round(dy))))

    # crop both to the same framing and stack them side by side
    compose = Image.new("RGB", (photo.width * 2 + 28, photo.height), (14, 18, 24))
    compose.paste(photo, (0, 0))
    compose.paste(canvas, (photo.width + 28, 0))
    compose.resize((compose.width // 2, compose.height // 2), Image.LANCZOS).save(
        OUT, quality=90
    )
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
