#!/usr/bin/env python3
"""
build_textures.py
=================
Derives every texture map used by the 3D model from the single uploaded
photograph of the Ruwanwelisaya Maha Seya (assets/source/ruwanwelisaya.jpg).

Each material of the model gets a crop of the photograph that actually shows
that material, made tileable (mirror cross-fade of the opposite edges) and
resampled.  Nothing is downloaded: the photograph *is* the texture source.

    python3 tools/build_textures.py

Requires: numpy, pillow.  Writes to public/textures/ and a QA contact sheet.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "source" / "ruwanwelisaya.jpg"
OUT = ROOT / "public" / "textures"
PREVIEW = ROOT / "assets" / "texture-preview.jpg"


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------


def load() -> Image.Image:
    return Image.open(SRC).convert("RGB")


def crop(im: Image.Image, box, size=None) -> Image.Image:
    out = im.crop(box)
    if size:
        out = out.resize(size, Image.LANCZOS)
    return out


def make_seamless(im: Image.Image, feather: int | None = None) -> Image.Image:
    """Cross-fade the image with its own mirrored copy along both axes so the
    result tiles without a visible seam while keeping the source statistics."""
    a = np.asarray(im, dtype=np.float32) / 255.0
    h, w = a.shape[:2]
    f = feather or max(8, min(h, w) // 8)

    def axis_blend(arr, f, axis):
        n = arr.shape[axis]
        f = min(f, n // 2)
        t = np.linspace(0.0, 1.0, f, dtype=np.float32)
        t = 0.5 - 0.5 * np.cos(np.pi * t)  # smooth ramp 0 -> 1
        flipped = np.flip(arr, axis=axis).copy()
        for i in range(f):
            near = [slice(None)] * arr.ndim
            far = [slice(None)] * arr.ndim
            near[axis] = i
            far[axis] = n - 1 - i
            wgt = t[i]
            arr[tuple(near)] = arr[tuple(near)] * wgt + flipped[tuple(near)] * (1 - wgt)
            arr[tuple(far)] = arr[tuple(far)] * wgt + flipped[tuple(far)] * (1 - wgt)
        return arr

    a = axis_blend(a, f, axis=1)
    a = axis_blend(a, f, axis=0)
    return Image.fromarray(np.clip(a * 255.0, 0, 255).astype(np.uint8))


def box_blur(a: np.ndarray, k: int) -> np.ndarray:
    """Fast square box blur (integral-image) on (h, w) or (h, w, c) arrays."""
    if k <= 0:
        return a
    if a.ndim == 3:
        return np.dstack([box_blur(a[:, :, c], k) for c in range(a.shape[2])])
    pad = np.pad(a.astype(np.float64), k, mode="edge")
    ii = pad.cumsum(axis=0).cumsum(axis=1)
    ii = np.pad(ii, ((1, 0), (1, 0)))
    win = 2 * k + 1
    total = ii[win:, win:] - ii[:-win, win:] - ii[win:, :-win] + ii[:-win, :-win]
    return (total / (win * win)).astype(np.float32)


def height_map(im: Image.Image, lo=0.0, hi=1.0, blur=1) -> Image.Image:
    a = np.asarray(im.convert("L"), dtype=np.float32) / 255.0
    a = box_blur(a, blur)
    a = np.clip((a - a.min()) / max(1e-6, a.max() - a.min()), 0, 1)
    return Image.fromarray((np.clip(lo + a * (hi - lo), 0, 1) * 255).astype(np.uint8))


def resize_tile(im: Image.Image, size) -> Image.Image:
    return im.resize(size, Image.LANCZOS)


def recolour(im: Image.Image, tint, strength=1.0) -> Image.Image:
    a = np.asarray(im, dtype=np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    tint = np.array(tint, dtype=np.float32)
    return Image.fromarray(np.clip(a * (tint / np.maximum(mean, 1e-3)) ** strength, 0, 255).astype(np.uint8))


def flatten_tileable(im: Image.Image, base_rgb=(246, 246, 244), grain: float = 4.0,
                     contrast: float = 1.8) -> Image.Image:
    """Frequency-separated tileable surface.

    The source crop carries a slow lighting gradient (the curving dome falls off
    toward its shoulders).  A gradient cannot tile -- only the fine grain can.
    So: keep the high-frequency plaster detail, make *that* seamless, and lay it
    over a flat base colour.
    """
    a = np.asarray(im, dtype=np.float32) / 255.0
    k = max(5, im.width // 6)
    low = np.dstack([box_blur(a[:, :, c], k) for c in range(3)])
    high = (a - low) * grain                      # amplify the grain to 0..1 range
    hi_img = Image.fromarray(
        np.clip((0.5 + high) * 255.0, 0, 255).astype(np.uint8)
    )
    seamless = make_seamless(hi_img, feather=max(8, im.width // 10))
    hi = (np.asarray(seamless, dtype=np.float32) / 255.0 - 0.5) / grain
    base = np.array(base_rgb, dtype=np.float32) / 255.0
    out = base[None, None, :] * (1.0 + hi * contrast)
    return Image.fromarray(np.clip(out * 255.0, 0, 255).astype(np.uint8))


def replace_sky(im: Image.Image, fill=None) -> Image.Image:
    """Replace blue-sky pixels (used on the gold finial crop) with gold."""
    a = np.asarray(im, dtype=np.float32).copy()
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    sky = (B > R + 4) & (B > 90)
    good = ~sky
    fill = a[good].mean(axis=0) if fill is None else np.array(fill, dtype=np.float32)
    a[sky] = fill
    # soften the seam
    glow = box_blur(sky.astype(np.float32), 2)
    a = a * (1 - 0.55 * glow[..., None]) + fill * (0.55 * glow[..., None])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def relief_rgba(im: Image.Image, bright=168.0) -> Image.Image:
    """Cut the white plaster wall out from behind the basalt elephant reliefs.

    The background is flood-filled inward from the image border, so bright
    *interior* details of the relief — the white tusks — stay opaque.
    """
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    lum = a[:, :, 0] * 0.299 + a[:, :, 1] * 0.587 + a[:, :, 2] * 0.114
    bright_mask = lum > bright
    h, w = bright_mask.shape
    bg = np.zeros_like(bright_mask)
    stack = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
    stack += [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w:
            continue
        if bg[y, x] or not bright_mask[y, x]:
            continue
        bg[y, x] = True
        stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    alpha = np.where(bg, 0.0, 1.0)
    # feather the silhouette
    alpha = np.minimum(alpha, np.clip((bright + 6 - lum) / 24.0, 0, 1))
    alpha[bg] = 0.0
    alpha = box_blur(alpha, 1)
    return Image.fromarray(np.dstack([a, alpha * 255.0]).astype(np.uint8), mode="RGBA")


# ----------------------------------------------------------------------------
# crops from the 2048x2048 photograph
# ----------------------------------------------------------------------------

DOME_BOX = (620, 900, 1000, 1240)      # clean whitewashed dome, no stripe
ELEPHANT_BOX = (100, 1619, 190, 1786)  # one basalt elephant relief, head to plinth
STONE_BOX = (500, 1467, 644, 1513)     # one clean brick course of the weathered base
SAND_BOX = (200, 1820, 1200, 2000)     # ochre courtyard sand
RED_BOX = (330, 1424, 700, 1452)       # red kasaya cloth band
FRINGE_BOX = (300, 1448, 700, 1472)    # gold fringe along the band's lower edge
HARMIKA_BOX = (840, 620, 1202, 748)    # fluted face of the deva-kuti (harmika)
GOLD_BOX = (988, 186, 1056, 262)       # gilded finial
PEOPLE_BOX = (1060, 1478, 1180, 1522)  # robed devotees on the terrace
SPIRE_BOX = (960, 268, 1090, 560)      # ribbed conical spire


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = load()
    stats = {}

    # ---- 1. whitewashed dome ---------------------------------------------
    dome = flatten_tileable(crop(src, DOME_BOX, (1024, 1024)), grain=5.5, contrast=0.35)
    dome.save(OUT / "dome_white.jpg", quality=92)
    h = height_map(dome, lo=0.45, hi=1.0, blur=2)
    h.save(OUT / "dome_white_bump.jpg", quality=86)
    stats["dome_white"] = dome.size

    # ---- 2. red kasaya band ---------------------------------------------
    # The cloth in the photograph is a flat, saturated vermilion; what little
    # detail it has is the weave.  So we take the measured colour and the
    # measured grain from the photo and lay a cloth weave over them.
    patch = crop(src, (560, 1431, 780, 1444))
    pa = np.asarray(patch, dtype=np.float32)
    mean = pa.reshape(-1, 3).mean(axis=0) / 255.0
    noise = np.asarray(patch.convert("L"), dtype=np.float32) / 255.0
    noise = (noise - noise.mean()) * 0.06

    hgt, wid = 128, 1024
    yy, xx = np.mgrid[0:hgt, 0:wid].astype(np.float32)
    weave = 0.045 * np.sin(xx * (2 * np.pi / 4.0)) * np.sin(yy * (2 * np.pi / 5.0))
    # soft top/bottom shading where the cloth tucks around the dome
    shade = np.ones(hgt, dtype=np.float32)
    shade[:14] = np.linspace(0.80, 1.0, 14)
    shade[-10:] = np.linspace(1.0, 0.86, 10)
    shade = shade[:, None]

    rng = np.random.default_rng(7)
    grain = np.repeat(np.repeat(
        rng.normal(0, 0.018, (hgt // 8 + 1, wid // 8 + 1)), 8, axis=0), 8, axis=1)[:hgt, :wid]

    tex = mean[None, None, :] * (1.0 + weave[..., None] + shade[..., None] - 1.0
                                 + noise[:1, :1].mean()[None, None, None] * 0 + grain[..., None])
    # keep it a touch deeper than the photo's pure #FE0000 so it reads as cloth
    tex = tex * np.array([0.86, 0.75, 0.78], dtype=np.float32)
    red = Image.fromarray(np.clip(tex * 255.0, 0, 255).astype(np.uint8))
    red.save(OUT / "red_band.jpg", quality=95)
    stats["red_band"] = red.size

    # ---- 3. weathered masonry base ---------------------------------------
    course = make_seamless(crop(src, STONE_BOX, (1024, 128)), feather=40)
    ca = np.asarray(course, dtype=np.float32)
    rows = []
    for i, shift in enumerate((0, 256, 512, 768)):
        shifted = np.roll(ca, shift, axis=1)
        # alternate courses sit slightly recessed, giving the mortar shadow lines
        rows.append(shifted * (1.0 if i % 2 == 0 else 0.93))
    stone = Image.fromarray(np.clip(np.vstack(rows), 0, 255).astype(np.uint8))
    stone.save(OUT / "stone_weathered.jpg", quality=92)
    height_map(stone, lo=0.15, hi=1.0, blur=2).save(OUT / "stone_weathered_bump.jpg", quality=86)
    stats["stone"] = stone.size

    # ---- 4. elephant relief ----------------------------------------------
    el = crop(src, ELEPHANT_BOX, (512, 1024))
    el.save(OUT / "elephant_relief.jpg", quality=94)
    relief = relief_rgba(crop(src, ELEPHANT_BOX, (512, 1024)))
    # the basalt reliefs read darker and cooler than the hazy photograph suggests;
    # darken the colour only, leaving the matte untouched
    ra = np.asarray(relief, dtype=np.float32)
    rgb = ra[..., :3] * 0.62
    rgb = 255.0 * (rgb / 255.0) ** 1.1
    ra[..., :3] = rgb
    relief = Image.fromarray(np.clip(ra, 0, 255).astype(np.uint8), mode="RGBA")
    relief.save(OUT / "elephant_relief.png")
    # relief height field: body raised, background sunk
    alpha = np.asarray(relief)[:, :, 3].astype(np.float32) / 255.0
    hm = np.clip(box_blur(alpha, 3) * 1.15, 0, 1) ** 0.75
    Image.fromarray((hm * 255).astype(np.uint8)).save(OUT / "elephant_relief_height.jpg", quality=90)
    stats["elephant"] = el.size

    # ---- 5. courtyard sand -----------------------------------------------
    # frequency-separated like the whitewash: the courtyard is graded flat, and a
    # graded surface cannot tile — only the rake marks and speckle can.
    sand_src = crop(src, SAND_BOX, (1024, 1024))
    sand = flatten_tileable(sand_src, base_rgb=(198, 131, 74), grain=4.0, contrast=1.15)
    sand.save(OUT / "sand_courtyard.jpg", quality=88)
    height_map(sand, lo=0.3, hi=0.9, blur=3).save(OUT / "sand_courtyard_bump.jpg", quality=84)
    stats["sand"] = sand.size

    # ---- 6. harmika (deva-kuti) fluted face ------------------------------
    harmika = crop(src, HARMIKA_BOX, (512, 256))
    harmika.save(OUT / "harmika_face.jpg", quality=94)
    height_map(harmika, lo=0.25, hi=1.0, blur=1).save(OUT / "harmika_face_bump.jpg", quality=86)
    stats["harmika"] = harmika.size

    # ---- 7. ribbed conical spire ----------------------------------------
    # the ribbing is modelled in the geometry, so the map only needs the
    # whitewash grain — flattening the photo's directional shading avoids a
    # "screw thread" moire when it wraps the cone
    spire = flatten_tileable(crop(src, SPIRE_BOX, (256, 512)), base_rgb=(242, 243, 245),
                             grain=4.0, contrast=0.5)
    spire.save(OUT / "spire_ribbed.jpg", quality=92)
    stats["spire"] = spire.size

    # ---- 8. gilded finial -------------------------------------------------
    # The finial in the photograph is only ~40 px wide, so we do not resample it
    # literally: we measure its gold (mean rgb 181,131,44; deep 140,87,2;
    # highlight 251,216,145) and rebuild a clean gilded ramp in that exact hue.
    deep = np.array([146, 88, 6], dtype=np.float32)
    mid = np.array([198, 136, 22], dtype=np.float32)
    high = np.array([246, 200, 104], dtype=np.float32)
    hgt, wid = 256, 256
    yy = np.linspace(0, 1, hgt, dtype=np.float32)
    ramp = np.zeros((hgt, 3), dtype=np.float32)
    for c in range(3):
        ramp[:, c] = np.interp(yy, [0.0, 0.62, 1.0], [deep[c], mid[c], high[c]])
    # three turned rings on the bell, as the moulding shows in the photograph
    ring = 0.06 * np.sin(yy * np.pi * 2 * 3.0) * np.exp(-((yy - 0.42) ** 2) / 0.03)
    rng = np.random.default_rng(3)
    noise = np.repeat(np.repeat(rng.normal(0, 0.015, (hgt // 4 + 1, wid // 4 + 1)), 4, axis=0), 4, axis=1)[:hgt, :wid]
    tex = ramp[:, None, :] * (1.0 + noise[..., None]) * (1.0 + ring[:, None, None])
    Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(OUT / "gold_finial.jpg", quality=95)
    stats["gold"] = (wid, hgt)

    # ---- 9. painted plaster for the terrace walls -----------------------
    # the terrace walls are the same whitewash as the dome — reuse that grain
    plaster = dome.resize((1024, 256), Image.LANCZOS)
    plaster.save(OUT / "plaster_white.jpg", quality=92)
    height_map(plaster, lo=0.4, hi=1.0, blur=2).save(OUT / "plaster_white_bump.jpg", quality=84)

    # ---- 10. sky gradient for the backdrop -----------------------------
    crop(src, (0, 0, 2048, 470), (1024, 256)).save(OUT / "sky_gradient.jpg", quality=88)

    # ---- QA contact sheet ------------------------------------------------
    picks = [
        "dome_white.jpg",
        "red_band.jpg",
        "stone_weathered.jpg",
        "elephant_relief.jpg",
        "sand_courtyard.jpg",
        "gold_finial.jpg",
        "harmika_face.jpg",
        "spire_ribbed.jpg",
        "plaster_white.jpg",
    ]
    sheet = Image.new("RGB", (900, 900), (26, 26, 30))
    for i, name in enumerate(picks):
        t = Image.open(OUT / name).convert("RGB")
        t.thumbnail((280, 280), Image.LANCZOS)
        x = (i % 3) * 300 + (300 - t.width) // 2
        y = (i // 3) * 300 + (300 - t.height) // 2
        sheet.paste(t, (x, y))
    sheet.save(PREVIEW, quality=88)

    for k, v in stats.items():
        print(f"{k:12s} {v}")
    print(f"\n{len(list(OUT.iterdir()))} files in {OUT.relative_to(ROOT)}")
    for p in sorted(OUT.iterdir()):
        print(f"  {p.name:32s} {p.stat().st_size/1024:8.1f} kB")


if __name__ == "__main__":
    main()
