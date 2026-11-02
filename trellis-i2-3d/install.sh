#!/usr/bin/env bash
# Install the TRELLIS image-to-3D service.
#
#   ./install.sh                 # service deps + TRELLIS CUDA stack into the active env
#   ./install.sh --new-env       # create a conda env called "trellis" first
#   ./install.sh --weights-only  # just pre-download the checkpoint
#   ./install.sh --no-cuda       # service deps only (mock backend / CI)
#
# TRELLIS needs Linux, CUDA 11.8 or 12.x, and an NVIDIA GPU with >= 16 GB VRAM.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR="$HERE/vendor/TRELLIS"

NEW_ENV=false
WEIGHTS_ONLY=false
CUDA=true
FLASH_ATTN=false

for arg in "$@"; do
  case "$arg" in
    --new-env) NEW_ENV=true ;;
    --weights-only) WEIGHTS_ONLY=true ;;
    --no-cuda) CUDA=false ;;
    --flash-attn) FLASH_ATTN=true ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------- vendor ----
if [ ! -d "$VENDOR/trellis" ]; then
  warn "vendored TRELLIS is missing; fetching it from GitHub"
  git clone https://github.com/microsoft/TRELLIS.git "$VENDOR"
  git -C "$VENDOR" submodule update --init --recursive
fi
say "using vendored TRELLIS at $VENDOR"

# ------------------------------------------------------------------- env ----
if $NEW_ENV; then
  command -v conda >/dev/null || { echo "conda is required for --new-env" >&2; exit 1; }
  say "creating conda env 'trellis' (python 3.10, torch 2.4.0, CUDA 11.8)"
  conda create -y -n trellis python=3.10
  # shellcheck disable=SC1091
  eval "$(conda shell.bash hook)"
  conda activate trellis
  conda install -y pytorch==2.4.0 torchvision==0.19.0 pytorch-cuda=11.8 -c pytorch -c nvidia
fi

PYTHON=${PYTHON:-python}
say "python: $($PYTHON -V 2>&1)"

if $WEIGHTS_ONLY; then
  "$PYTHON" "$HERE/scripts/fetch_weights.py"
  exit 0
fi

# ------------------------------------------------------- service packages ----
say "installing service dependencies"
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r "$HERE/requirements.txt"

# ------------------------------------------------------------ TRELLIS deps ----
if $CUDA; then
  if ! "$PYTHON" - <<'PY'
import sys
try:
    import torch
except Exception:
    sys.exit(1)
sys.exit(0 if torch.cuda.is_available() else 1)
PY
  then
    warn "CUDA is not available in this environment."
    warn "The service will start in smoke-test mode. Re-run on a GPU host, or"
    warn "install torch with CUDA first, e.g.:"
    echo "    pip install torch==2.4.0 torchvision==0.19.0 --index-url https://download.pytorch.org/whl/cu118" >&2
  else
    say "installing the TRELLIS CUDA stack (spconv, diffoctreerast, nvdiffrast, ...)"
    pushd "$VENDOR" >/dev/null
    FLAGS=(--basic --xformers --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast)
    if $FLASH_ATTN; then
      FLAGS+=(--flash-attn)
    else
      warn "installing xformers only; set ATTN_BACKEND=xformers when running"
    fi
    # shellcheck disable=SC1091
    . ./setup.sh "${FLAGS[@]}"
    popd >/dev/null
  fi
fi

# ---------------------------------------------------------------- weights ----
say "pre-fetching model weights (optional, ~4 GB)"
"$PYTHON" "$HERE/scripts/fetch_weights.py" || warn "weight pre-fetch skipped"

cat <<'EOF'

Done.

  ./run.sh                    # http://localhost:8100  (web UI + API)
  python -m pytest tests -q   # GPU-free test suite

If you installed into a fresh conda env:
  conda activate trellis && ./run.sh
EOF
