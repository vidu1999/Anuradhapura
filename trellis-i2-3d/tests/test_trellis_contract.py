"""Static contract tests against the vendored TRELLIS code.

The GPU path cannot run in CI, so instead of executing it we assert — by
parsing the vendored sources — that every model entry point the service calls
still exists with the parameters we pass.  That catches the realistic failure
mode of this repository (someone refreshes `vendor/TRELLIS` and an API moved),
without needing CUDA or the ~4 GB checkpoint.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

VENDOR = Path(__file__).resolve().parents[1] / "vendor" / "TRELLIS"


def _tree(relative: str) -> ast.Module:
    path = VENDOR / relative
    assert path.is_file(), f"vendored file missing: {path}"
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _function(tree: ast.Module, name: str, *, in_class: str | None = None) -> ast.FunctionDef | ast.AsyncFunctionDef:
    scope = tree.body
    if in_class:
        klass = next(
            (node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == in_class),
            None,
        )
        assert klass is not None, f"class {in_class} not found"
        scope = klass.body
    for node in scope:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"function {name} not found" + (f" in {in_class}" if in_class else ""))


def _params(node) -> list[str]:
    return [arg.arg for arg in node.args.args]


PIPELINE = "trellis/pipelines/trellis_image_to_3d.py"
POST = "trellis/utils/postprocessing_utils.py"
RENDER = "trellis/utils/render_utils.py"
GAUSSIAN = "trellis/representations/gaussian/gaussian_model.py"


def test_pipeline_class_exists():
    tree = _tree(PIPELINE)
    classes = [node.name for node in tree.body if isinstance(node, ast.ClassDef)]
    assert "TrellisImageTo3DPipeline" in classes


def test_pipeline_methods_the_service_calls():
    tree = _tree(PIPELINE)
    cls = "TrellisImageTo3DPipeline"

    assert "input" in _params(_function(tree, "preprocess_image", in_class=cls))
    assert "image" in _params(_function(tree, "get_cond", in_class=cls))

    ss = _function(tree, "sample_sparse_structure", in_class=cls)
    assert {"cond", "num_samples", "sampler_params"} <= set(_params(ss))

    slat = _function(tree, "sample_slat", in_class=cls)
    assert {"cond", "coords", "sampler_params"} <= set(_params(slat))

    decode = _function(tree, "decode_slat", in_class=cls)
    assert {"slat", "formats"} <= set(_params(decode))

    # the factory we load the checkpoint with
    from_pretrained = _function(tree, "from_pretrained", in_class=cls)
    assert "path" in _params(from_pretrained)


def test_to_glb_signature():
    tree = _tree(POST)
    to_glb = _function(tree, "to_glb")
    params = _params(to_glb)
    assert params[0] == "app_rep" and params[1] == "mesh"
    for expected in ("simplify", "texture_size"):
        assert expected in params, f"to_glb lost its {expected} argument"


def test_gaussian_and_render_helpers():
    assert "path" in _params(_function(_tree(GAUSSIAN), "save_ply", in_class="Gaussian"))
    render_video = _function(_tree(RENDER), "render_video")
    assert "sample" in _params(render_video)


def test_model_configs_are_present():
    """The published checkpoints must describe the samplers we assume."""
    configs = VENDOR / "configs"
    assert configs.is_dir()
    names = {path.name for path in configs.rglob("*.json")}
    assert any("slat" in name for name in names), names
    assert any("sparse" in name or "ss_" in name for name in names), names


def test_vendored_licence_is_intact():
    licence = VENDOR / "LICENSE"
    assert licence.is_file()
    text = licence.read_text(encoding="utf-8").lower()
    assert "mit license" in text and "microsoft" in text


@pytest.mark.parametrize(
    "module",
    [
        "trellis/pipelines/__init__.py",
        "trellis/utils/__init__.py",
        "trellis/representations/mesh/flexicubes/flexicubes.py",
    ],
)
def test_required_module_files_exist(module: str):
    assert (VENDOR / module).is_file()
