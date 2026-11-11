#!/usr/bin/env python3
"""Download the TRELLIS checkpoint into ./weights for offline / fast start-up.

    python scripts/fetch_weights.py                    # microsoft/TRELLIS-image-large
    python scripts/fetch_weights.py --model microsoft/TRELLIS-text-large

Then run with ``TRELLIS_MODEL=./weights/TRELLIS-image-large``.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="microsoft/TRELLIS-image-large")
    parser.add_argument("--dest", type=Path, default=SERVICE_ROOT / "weights")
    parser.add_argument("--token", default=None, help="Hugging Face token (or HF_TOKEN)")
    args = parser.parse_args()

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("huggingface_hub is required: pip install huggingface_hub", file=sys.stderr)
        return 2

    args.dest.mkdir(parents=True, exist_ok=True)
    local_dir = args.dest / args.model.split("/")[-1]
    print(f"downloading {args.model} → {local_dir}")
    snapshot_download(
        repo_id=args.model,
        local_dir=str(local_dir),
        token=args.token,
        resume_download=True,
    )
    print(f"\ndone. start the service with:\n  TRELLIS_MODEL={local_dir} ./run.sh")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
