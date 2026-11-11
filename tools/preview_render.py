#!/usr/bin/env python3
"""
preview_render.py
=================
A tiny z-buffered, texture-mapping rasteriser used to QA the exported GLB
without a browser.  Reads public/models/ruwanwelisaya.glb, renders it with a
directional sun + sky ambient, and writes a PNG.

    python3 tools/preview_render.py --out docs/render-front.png
    python3 tools/preview_render.py --cam 0,26,150 --look 0,38,0 --fov 36

It is a QA tool, not a renderer: nearest-neighbour texture sampling, one light.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public" / "models" / "ruwanwelisaya.glb"

COMPONENT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load_glb(path: Path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB"
    off = 12
    js = None
    binchunk = None
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        off += 8
        chunk = data[off : off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            binchunk = chunk
    return js, binchunk


def accessor(gltf, binchunk, idx):
    a = gltf["accessors"][idx]
    bv = gltf["bufferViews"][a["bufferView"]]
    dtype = COMPONENT[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(binchunk, dtype=dtype, count=a["count"] * n, offset=start)
    return arr.reshape(a["count"], n) if n > 1 else arr


def image_of(gltf, binchunk, tex_index):
    tex = gltf["textures"][tex_index]
    img = gltf["images"][tex["source"]]
    bv = gltf["bufferViews"][img["bufferView"]]
    raw = binchunk[bv.get("byteOffset", 0) : bv.get("byteOffset", 0) + bv["byteLength"]]
    import io

    return np.asarray(Image.open(io.BytesIO(raw)).convert("RGBA"), dtype=np.float32) / 255.0


def look_at(eye, target, up=(0.0, 1.0, 0.0)):
    eye = np.array(eye, dtype=np.float64)
    target = np.array(target, dtype=np.float64)
    f = target - eye
    f /= np.linalg.norm(f)
    up = np.array(up, dtype=np.float64)
    s = np.cross(f, up)
    s /= np.linalg.norm(s)
    u = np.cross(s, f)
    m = np.eye(4)
    m[0, :3] = s
    m[1, :3] = u
    m[2, :3] = -f
    m[:3, 3] = -m[:3, :3] @ eye
    return m


def perspective(fovy_deg, aspect, near=0.4, far=4000.0):
    f = 1.0 / math.tan(math.radians(fovy_deg) / 2)
    m = np.zeros((4, 4))
    m[0, 0] = f / aspect
    m[1, 1] = f
    m[2, 2] = (far + near) / (near - far)
    m[2, 3] = (2 * far * near) / (near - far)
    m[3, 2] = -1
    return m


def sky_color(dirvec):
    """Simple vertical gradient matching the photograph's deep blue zenith."""
    t = np.clip(dirvec[1] * 1.12, 0, 1) ** 0.62
    top = np.array([0.055, 0.31, 0.70])
    bot = np.array([0.72, 0.83, 0.92])
    return bot * (1 - t) + top * t


def render(eye, target, fov, W, H, out, sun=(0.55, 0.62, 0.56), ambient=0.42, exposure=1.0):
    gltf, binchunk = load_glb(GLB)
    view = look_at(eye, target)
    proj = perspective(fov, W / H)
    vp = proj @ view

    sun = np.array(sun, dtype=np.float64)
    sun /= np.linalg.norm(sun)

    # background
    inv = np.linalg.inv(vp)
    ys, xs = np.mgrid[0:H, 0:W]
    ndc = np.stack(
        [(xs + 0.5) / W * 2 - 1, 1 - (ys + 0.5) / H * 2, np.full_like(xs, -1.0, dtype=float), np.ones_like(xs, dtype=float)],
        axis=-1,
    )
    dirs = ndc @ inv.T
    dirs = dirs[..., :3] / dirs[..., 3:4]
    dirs = dirs - np.asarray(eye)
    dirs /= np.linalg.norm(dirs, axis=-1, keepdims=True)
    sky = np.stack([sky_color(dirs[y, x]) for y in range(0, H, 1) for x in range(0, 1)], axis=0) if False else None
    # vectorised sky
    t = np.clip(dirs[..., 1] * 1.12, 0, 1) ** 0.62
    top = np.array([0.055, 0.31, 0.70])
    bot = np.array([0.72, 0.83, 0.92])
    frame = bot[None, None, :] * (1 - t[..., None]) + top[None, None, :] * t[..., None]

    zbuf = np.full((H, W), np.inf)
    texcache = {}

    for node in gltf["nodes"]:
        if "mesh" not in node:
            continue
        for prim in gltf["meshes"][node["mesh"]]["primitives"]:
            mat = gltf["materials"][prim["material"]]
            pbr = mat["pbrMetallicRoughness"]
            pos = accessor(gltf, binchunk, prim["attributes"]["POSITION"]).astype(np.float64)
            nrm = accessor(gltf, binchunk, prim["attributes"]["NORMAL"]).astype(np.float64)
            uv = accessor(gltf, binchunk, prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
            idx = accessor(gltf, binchunk, prim["indices"]).astype(np.int64)

            tex = None
            if "baseColorTexture" in pbr:
                ti = pbr["baseColorTexture"]["index"]
                if ti not in texcache:
                    texcache[ti] = image_of(gltf, binchunk, ti)
                tex = texcache[ti]
            base = np.array(pbr.get("baseColorFactor", [1, 1, 1, 1])[:3])

            # world-space shading per vertex
            lam = np.clip(nrm @ sun, 0, 1)
            shade = ambient + (1.0 - ambient) * lam ** 0.85
            # metals get a floor + a bit of fake environment reflection, otherwise
            # a lone directional light renders them almost black
            if pbr.get("metallicFactor", 0.0) > 0.5:
                shade = 0.45 + 0.55 * shade
            # fake sky bounce from above
            bounce = np.clip(nrm[:, 1], 0, 1) * 0.12
            shade = shade + bounce

            tri = pos[idx].reshape(-1, 3, 3)
            triuv = uv[idx].reshape(-1, 3, 2)
            trishade = shade[idx].reshape(-1, 3)

            # clip-space
            ph = np.concatenate([tri, np.ones(tri.shape[:2] + (1,))], axis=2) @ vp.T
            w = ph[:, :, 3]
            vis = np.all(w > 0.05, axis=1)
            tri, triuv, trishade, ph, w = tri[vis], triuv[vis], trishade[vis], ph[vis], w[vis]
            ndc3 = ph[:, :, :3] / w[:, :, None]
            sx = (ndc3[:, :, 0] * 0.5 + 0.5) * W
            sy = (1 - (ndc3[:, :, 1] * 0.5 + 0.5)) * H
            depth = ndc3[:, :, 2]

            # back-face culling in screen space (skip for double-sided/open shells:
            # we keep both, the z-buffer sorts it out)
            x0 = np.floor(sx.min(axis=1)).astype(int)
            x1 = np.ceil(sx.max(axis=1)).astype(int)
            y0 = np.floor(sy.min(axis=1)).astype(int)
            y1 = np.ceil(sy.max(axis=1)).astype(int)
            keep = (x1 >= 0) & (x0 < W) & (y1 >= 0) & (y0 < H) & (x1 > x0) & (y1 > y0)
            if not keep.any():
                continue
            for t_i in np.nonzero(keep)[0]:
                xs0, xs1 = max(0, x0[t_i]), min(W, x1[t_i] + 1)
                ys0, ys1 = max(0, y0[t_i]), min(H, y1[t_i] + 1)
                if xs1 - xs0 < 1 or ys1 - ys0 < 1:
                    continue
                px = np.arange(xs0, xs1) + 0.5
                py = np.arange(ys0, ys1) + 0.5
                gx, gy = np.meshgrid(px, py)
                ax, ay = sx[t_i, 0], sy[t_i, 0]
                bx, by = sx[t_i, 1], sy[t_i, 1]
                cx, cy = sx[t_i, 2], sy[t_i, 2]
                area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
                if abs(area) < 1e-9:
                    continue
                b0 = ((bx - gx) * (cy - gy) - (by - gy) * (cx - gx)) / area
                b1 = ((cx - gx) * (ay - gy) - (cy - gy) * (ax - gx)) / area
                b2 = 1 - b0 - b1
                inside = (b0 >= -1e-6) & (b1 >= -1e-6) & (b2 >= -1e-6)
                if not inside.any():
                    continue
                zz = b0 * depth[t_i, 0] + b1 * depth[t_i, 1] + b2 * depth[t_i, 2]
                sub_z = zbuf[ys0:ys1, xs0:xs1]
                mask = inside & (zz < sub_z - 1e-6)
                if not mask.any():
                    continue

                iw = b0 / w[t_i, 0] + b1 / w[t_i, 1] + b2 / w[t_i, 2]
                iw = np.where(np.abs(iw) < 1e-12, 1e-12, iw)
                u = (b0 * triuv[t_i, 0, 0] / w[t_i, 0] + b1 * triuv[t_i, 1, 0] / w[t_i, 1] + b2 * triuv[t_i, 2, 0] / w[t_i, 2]) / iw
                v = (b0 * triuv[t_i, 0, 1] / w[t_i, 0] + b1 * triuv[t_i, 1, 1] / w[t_i, 1] + b2 * triuv[t_i, 2, 1] / w[t_i, 2]) / iw

                if tex is not None:
                    th, tw = tex.shape[:2]
                    tx = np.clip((u % 1.0) * tw, 0, tw - 1).astype(int)
                    ty = np.clip((1 - (v % 1.0)) * th, 0, th - 1).astype(int)
                    col = tex[ty, tx]
                    alpha = col[..., 3]
                else:
                    col = np.ones(u.shape + (3,))
                    alpha = np.ones_like(u)

                amb = (b0 * trishade[t_i, 0] + b1 * trishade[t_i, 1] + b2 * trishade[t_i, 2])
                rgb = col[..., :3] * base[None, None, :] * amb[..., None]

                cut = mat.get("alphaCutoff", 0.5) if mat.get("alphaMode") == "MASK" else 0.0
                mask = mask & (alpha > max(cut, 0.001))
                if not mask.any():
                    continue
                submask = mask
                sub_z[submask] = zz[submask]
                sub_rgb = frame[ys0:ys1, xs0:xs1]
                sub_rgb[submask] = rgb[submask]

    img = np.clip(frame, 0, 1) ** (1 / 2.2)
    img = np.clip(img * exposure, 0, 1)
    Image.fromarray((img * 255).astype(np.uint8)).save(out)
    print(f"wrote {out}  ({W}x{H})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs" / "render.png"))
    ap.add_argument("--cam", default="0,24,152")
    ap.add_argument("--look", default="0,36,0")
    ap.add_argument("--fov", type=float, default=36.0)
    ap.add_argument("--size", default="900x900")
    ap.add_argument("--exposure", type=float, default=1.0)
    a = ap.parse_args()
    W, H = (int(x) for x in a.size.lower().split("x"))
    eye = tuple(float(x) for x in a.cam.split(","))
    tgt = tuple(float(x) for x in a.look.split(","))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    render(eye, tgt, a.fov, W, H, a.out, exposure=a.exposure)
