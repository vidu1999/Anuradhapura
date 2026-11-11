#!/usr/bin/env bash
# End-to-end check on a GPU host: generate a GLB from the vendored example image
# and assert that the file is a valid binary glTF.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

PYTHON=${PYTHON:-python}
IMAGE=${1:-"$HERE/vendor/TRELLIS/assets/example_image/T.png"}
OUT=${2:-"$HERE/outputs/smoke"}

if [ ! -f "$IMAGE" ]; then
  echo "example image not found: $IMAGE" >&2
  echo "(the vendored copy omits demo media — pass your own image)" >&2
  exit 2
fi

echo "==> generating from $IMAGE"
"$PYTHON" -m trellis_service.cli "$IMAGE" --out "$OUT" --json | tee "$OUT/summary.json"

echo "==> validating $OUT/model.glb"
"$PYTHON" - "$OUT/model.glb" <<'PY'
import struct, sys
path = sys.argv[1]
data = open(path, "rb").read()
magic, version, length = struct.unpack_from("<III", data, 0)
assert magic == 0x46546C67, "not a GLB"
assert version == 2, f"unexpected glTF version {version}"
assert length == len(data), "truncated GLB"
print(f"ok: {len(data)/1e6:.2f} MB, glTF {version}")
PY
