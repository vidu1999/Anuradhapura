# TRELLIS image → 3D

A self-contained service that turns **one photo into a textured GLB**, built
*only* on [microsoft/TRELLIS](https://github.com/microsoft/TRELLIS). The model
code is vendored in `vendor/TRELLIS` (see [VENDOR.md](VENDOR.md)); everything
else here is plumbing: a job queue, an HTTP API, a CLI, and a browser viewer.

```
photo.png ──▶ preprocess ──▶ sparse structure ──▶ SLAT sampler ──▶ mesh + gaussians
             (rembg, 518²)   (rectified flow)     (appearance)      │
                                                                   ▼
                                                     UV unwrap + texture bake ──▶ model.glb
```

There is no second model and no fallback reconstruction: the 3D asset is produced
by the vendored TRELLIS pipeline end to end.

---

## Requirements

| | |
| --- | --- |
| GPU | NVIDIA, **≥ 16 GB VRAM** (verified upstream on A100 / A6000) |
| CUDA | 11.8 or 12.2 toolkit (needed to compile spconv / diffoctreerast / nvdiffrast) |
| OS | Linux |
| Python | 3.8+ (3.10 recommended) |
| Disk | ~12 GB (deps + ~4 GB checkpoint) |

Without a CUDA GPU the service still starts and stays usable: it falls back to a
**smoke-test backend** that returns a placeholder GLB (your image wrapped on a
sphere), clearly labelled in the UI and in every response. That backend exists
so the upload → job → viewer path can be exercised and tested; it is *not* a
reconstruction.

---

## Quick start (GPU host)

```bash
cd trellis-i2-3d
./install.sh --new-env      # conda env "trellis", torch 2.4 + cu118, TRELLIS CUDA stack
conda activate trellis
./run.sh                    # → http://localhost:8100
```

`install.sh` flags:

| flag | effect |
| --- | --- |
| `--new-env` | create and use a conda env named `trellis` |
| `--flash-attn` | also build flash-attn (faster attention; skip on V100) |
| `--no-cuda` | service dependencies only — mock backend / CI |
| `--weights-only` | just pre-download the checkpoint into `weights/` |

### Docker

```bash
docker compose up --build          # GPU reservation is in docker-compose.yml
# or
docker build -t trellis-i2-3d .
docker run --gpus all -p 8100:8100 -v $PWD/weights:/app/weights trellis-i2-3d
```

The image compiles the CUDA extensions during the build (~20 min) and uses
`ATTN_BACKEND=xformers` to avoid a flash-attn build.

---

## Using it

### Web interface

Open `http://localhost:8100`, drop an image, adjust the sampler if you like, hit
**Generate 3D model**. The GLB appears in a three.js viewer with a turntable,
wireframe and grid toggle, and can be downloaded.

### CLI

```bash
python -m trellis_service.cli photo.jpg --out out/monument \
    --seed 1 --texture-size 2048 --simplify 0.95 --ply --preview
```

Progress goes to stderr, a JSON summary to stdout:

```json
{ "ok": true, "backend": "trellis", "glb": "out/monument/model.glb",
  "stats": { "mesh_faces": 148213, "voxels": 41233, "timings": {...} }, "seconds": 71.4 }
```

### HTTP API

```bash
# 1. upload
curl -s -X POST http://localhost:8100/api/generate \
     -F image=@photo.jpg -F seed=1 -F texture_size=1024
# → {"id":"703ad066859b","status":"queued","jobs_url":"/api/jobs/703ad066859b"}

# 2. poll (status, progress, stage, log tail, output URLs)
curl -s http://localhost:8100/api/jobs/703ad066859b

# 3. download
curl -O http://localhost:8100/api/outputs/703ad066859b/model.glb
```

| endpoint | purpose |
| --- | --- |
| `GET /api/health` | backend, GPU, VRAM, model, defaults |
| `POST /api/generate` | multipart `image` + optional sampler params → `202 {id}` |
| `GET /api/jobs/{id}` | status, stage, progress, log, file URLs, stats |
| `GET /api/jobs` | recent jobs |
| `DELETE /api/jobs/{id}` | drop a job and its files |
| `GET /api/outputs/{id}/{file}` | `model.glb`, `model.ply`, `preview.png`, `upload.png` |

Interactive API docs are at `/docs` (FastAPI default).

---

## Configuration

All settings are environment variables (see `trellis_service/config.py`).

| variable | default | meaning |
| --- | --- | --- |
| `TRELLIS_MODEL` | `microsoft/TRELLIS-image-large` | HF id **or** a local directory from `scripts/fetch_weights.py` |
| `TRELLIS_DEVICE` | `cuda` | `cuda`, `cuda:0`, … |
| `TRELLIS_BACKEND` | `auto` | `auto` \| `trellis` \| `mock` |
| `ATTN_BACKEND` | `flash-attn` | set to `xformers` if flash-attn is not installed |
| `SPCONV_ALGO` | `native` | `native` skips spconv's start-up benchmark |
| `TRELLIS_SS_STEPS` / `TRELLIS_SS_CFG` | `12` / `7.5` | sparse-structure sampler |
| `TRELLIS_SLAT_STEPS` / `TRELLIS_SLAT_CFG` | `12` / `3.0` | structured-latent sampler |
| `TRELLIS_TEXTURE_SIZE` | `1024` | baked texture resolution |
| `TRELLIS_SIMPLIFY` | `0.95` | fraction of faces removed before unwrapping |
| `TRELLIS_MAX_UPLOAD_MB` | `20` | upload cap |
| `TRELLIS_JOB_TTL_S` | `3600` | how long outputs are kept |
| `TRELLIS_MAX_CONCURRENT` | `1` | generation workers (keep at 1 per GPU) |
| `TRELLIS_PORT` / `TRELLIS_HOST` | `8100` / `0.0.0.0` | bind address |

---

## How the model is called

`trellis_service/generate.py` mirrors `TrellisImageTo3DPipeline.run()` but keeps
the stages separate so the API can report progress between them:

| stage | call |
| --- | --- |
| preprocess | `pipeline.preprocess_image(image)` — background removal + 518² crop |
| sparse structure | `pipeline.get_cond([img])` → `pipeline.sample_sparse_structure(cond, 1, {...})` |
| structured latent | `pipeline.sample_slat(cond, coords, {...})` |
| decode | `pipeline.decode_slat(slat, ["mesh", "gaussian"])` |
| export | `postprocessing_utils.to_glb(gaussian, mesh, simplify, texture_size)` → `model.glb` |

Progress inside a stage comes from TRELLIS's own `tqdm` output, which is parsed
out of the captured stdout/stderr (`trellis_service/progress.py`) and surfaced as
a percentage plus a live log.

---

## Testing

```bash
pip install -r requirements-dev.txt
python -m pytest tests -q          # 19 tests, all GPU-free
```

What the suite covers:

* option coercion from form strings, progress/tqdm parsing, monotonic progress;
* the job store, including a guard that `DELETE` can only remove its own
  directory inside `outputs/`;
* the full HTTP flow against the smoke-test backend (upload → poll → download a
  valid `glTF` binary, rejection of non-images, 404s, static assets);
* **contract tests** that parse the vendored TRELLIS sources and assert every
  method/signature the service calls still exists — this is what protects the
  GPU path when `vendor/TRELLIS` is refreshed.

On a GPU host, run the end-to-end check:

```bash
./scripts/smoke_test.sh /path/to/object.jpg      # generates + validates the GLB
```

### What could not be verified here

This development sandbox has **no GPU and no access to the Hugging Face model
hub**, so `python -m pytest` exercises everything *except* the model forward
pass. The first real inference will be on your GPU host; `scripts/smoke_test.sh`
is the one command that proves it. If something fails there, the job log in the
UI (or the CLI stderr) carries TRELLIS's own traceback.

---

## Notes on quality

* One image → one asset: TRELLIS invents the unseen side. Feed a clean, evenly
  lit photo of a single object that fills the frame.
* The GLB bake (UV unwrap + texture) is usually the longest step; `simplify`
  trades detail for time and file size.
* Multi-image conditioning exists upstream (`run_multi_image`) but is not wired
  into this service yet.
* Model weights are downloaded at first use into `HF_HOME` (or `weights/` when
  pre-fetched) and are subject to their own licence on Hugging Face.

## Provenance and licences

* TRELLIS code: MIT, © Microsoft — vendored, pinned, licence included
  ([VENDOR.md](VENDOR.md)).
* FlexiCubes: Apache-2.0 — vendored as TRELLIS's submodule.
* three.js (web viewer): MIT — `web/vendor/three/LICENSE`.
* Images you generate are yours, subject to the model weights' licence.
