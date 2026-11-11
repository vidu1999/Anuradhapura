# Vendored code

The service does not re-implement any part of the model: it calls the upstream
TRELLIS package in `vendor/TRELLIS`. The copy is pinned so builds are
reproducible.

| Path | Upstream | Commit | Licence |
| --- | --- | --- | --- |
| `vendor/TRELLIS` | https://github.com/microsoft/TRELLIS | `193e0502b5cb3eb5997ec457d5340e95d09b158e` | MIT |
| `vendor/TRELLIS/trellis/representations/mesh/flexicubes` | https://github.com/MaxtirError/FlexiCubes | `815e075a2a400d06c48d94c347674344ed6ae5c5` | Apache-2.0 |

## What was removed

To keep this repository small, the following upstream material is **not**
vendored. None of it is needed to run the model:

* `assets/` — the demo images and videos (~60 MB).
* `dataset_toolkits/` — TRELLIS-500K dataset preparation tooling.
* `trellis/representations/mesh/flexicubes/{images,examples}` — FlexiCubes demo media.

Everything else (`trellis/`, `configs/`, `setup.sh`, the example scripts and
both licences) is untouched.

## Refreshing

```bash
rm -rf vendor/TRELLIS
git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git vendor/TRELLIS
rm -rf vendor/TRELLIS/.git vendor/TRELLIS/assets vendor/TRELLIS/dataset_toolkits \
       vendor/TRELLIS/trellis/representations/mesh/flexicubes/{.git,images,examples}
```

The web viewer bundles three.js (MIT) in `web/vendor/three` — see its `LICENSE`.
