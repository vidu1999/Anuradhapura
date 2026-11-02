# TRELLIS image → 3D service.
#
#   docker build -t trellis-i2-3d .
#   docker run --gpus all -p 8100:8100 -v $PWD/weights:/app/weights trellis-i2-3d
#
# The TRELLIS CUDA submodules (spconv, diffoctreerast, nvdiffrast) are compiled
# during the build, so the `builder` stage needs ~20 minutes and a CUDA devel
# image.  Runtime needs an NVIDIA GPU with >= 16 GB VRAM and the NVIDIA
# container toolkit.
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.10 python3.10-dev python3.10-venv python3-pip \
        git build-essential ninja-build libgl1 libglib2.0-0 libjpeg-dev \
        ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3.10 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --upgrade pip setuptools wheel \
 && pip install torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu118

WORKDIR /app

# ---- vendored model code (pinned in VENDOR.md) ------------------------------
COPY vendor/TRELLIS /app/vendor/TRELLIS
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# ---- TRELLIS' own CUDA extensions ------------------------------------------
# xformers + the rasterisers; flash-attn is omitted for build speed, so the
# runtime default is ATTN_BACKEND=xformers.
ENV ATTN_BACKEND=xformers \
    SPCONV_ALGO=native \
    FORCE_CUDA=1 \
    TORCH_CUDA_ARCH_LIST="7.0;7.5;8.0;8.6;8.9;9.0"
WORKDIR /app/vendor/TRELLIS
RUN bash -c '. ./setup.sh --basic --xformers --diffoctreerast --spconv --mipgaussian --nvdiffrast'

# ---- service ---------------------------------------------------------------
WORKDIR /app
COPY trellis_service /app/trellis_service
COPY web /app/web
COPY scripts /app/scripts
COPY run.sh /app/run.sh
RUN mkdir -p /app/outputs /app/weights

ENV TRELLIS_HOST=0.0.0.0 \
    TRELLIS_PORT=8100 \
    TRELLIS_OUTPUT_DIR=/app/outputs \
    HF_HOME=/app/weights/hf

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s \
    CMD python -c "import urllib.request,json,sys; \
        d=json.load(urllib.request.urlopen('http://127.0.0.1:8100/api/health')); \
        sys.exit(0 if d.get('ok') else 1)"

CMD ["python", "-m", "uvicorn", "trellis_service.api:app", "--host", "0.0.0.0", "--port", "8100"]
