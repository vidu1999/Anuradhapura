#!/usr/bin/env bash
# Start the TRELLIS image-to-3D service (web UI at /, API under /api).
#
#   ./run.sh                       # http://0.0.0.0:8100
#   TRELLIS_PORT=9000 ./run.sh
#   TRELLIS_MODEL=./weights/TRELLIS-image-large ./run.sh   # offline weights
#   TRELLIS_BACKEND=mock ./run.sh                          # force smoke-test mode
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

PYTHON=${PYTHON:-python}
HOST=${TRELLIS_HOST:-0.0.0.0}
PORT=${TRELLIS_PORT:-8100}

exec "$PYTHON" -m uvicorn trellis_service.api:app --host "$HOST" --port "$PORT" --workers 1
