"""Tests that run without a GPU.

They exercise everything the service owns: option coercion, progress parsing,
the job store, the HTTP API, and the write path of a GLB.  The model itself is
covered by the smoke-test backend; real inference is verified on a GPU host with
``scripts/smoke_test.sh``.
"""

from __future__ import annotations

import io
import time

import pytest
from PIL import Image

from trellis_service.config import Settings, load_settings
from trellis_service.generate import GenOptions
from trellis_service.progress import Progress


# ---------------------------------------------------------------- fixtures --
@pytest.fixture()
def png_bytes() -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for x in range(80, 176):
        for y in range(40, 220):
            image.putpixel((x, y), (196, 62, 44, 255))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture()
def settings(tmp_path) -> Settings:
    base = load_settings()
    return Settings(
        **{
            **base.__dict__,
            "backend": "mock",
            "output_dir": tmp_path / "outputs",
            "job_ttl_s": 60,
        }
    )


# ------------------------------------------------------------------ options --
def test_options_are_coerced_from_form_strings():
    defaults = GenOptions(seed=42, texture_size=1024, simplify=0.95)
    opts = GenOptions.from_mapping(
        {"seed": "7", "texture_size": "2048", "simplify": "0.5", "export_ply": "true"}, defaults
    )
    assert opts.seed == 7
    assert opts.texture_size == 2048
    assert opts.simplify == pytest.approx(0.5)
    assert opts.export_ply is True
    # untouched values fall back to the service defaults
    assert opts.ss_steps == defaults.ss_steps


def test_options_ignore_empty_values():
    defaults = GenOptions(seed=11)
    opts = GenOptions.from_mapping({"seed": "", "texture_size": None}, defaults)
    assert opts.seed == 11


# ----------------------------------------------------------------- progress --
def test_progress_parses_tqdm_bars():
    seen: list[float] = []
    progress = Progress(callback=lambda value, stage: seen.append(value))
    progress.begin("structured latent", 0.4, 0.8)
    with progress.capture_output():
        print("loading text encoder")          # plain stdout
        import sys

        sys.stderr.write("\r 50%|#####     | 6/12 [00:03<00:03, 1.8it/s]")
        sys.stderr.flush()
    assert progress.log and any("encoding" in line or "loading" in line for line in progress.log)
    assert 0.59 < progress.value < 0.61, progress.value
    assert seen, "callback should have been called"


def test_progress_never_goes_backwards():
    progress = Progress()
    progress.begin("a", 0.2, 0.5)
    progress.fraction(1.0)
    progress.begin("b", 0.1, 0.3)
    assert progress.value == pytest.approx(0.5)


# -------------------------------------------------------------- mock backend --
def test_mock_backend_writes_a_glb(settings, tmp_path):
    from trellis_service.runtime import build_runtime

    runtime = build_runtime(settings)
    assert runtime.backend == "mock"

    progress = Progress()
    image = Image.new("RGBA", (128, 128), (30, 120, 200, 255))
    result = runtime.generate(image, GenOptions(), progress, tmp_path / "job")

    glb = tmp_path / "job" / "model.glb"
    assert glb.is_file()
    assert glb.read_bytes()[:4] == b"glTF", "output must be a binary glTF"
    assert result.stats["backend"] == "mock"
    assert result.stats["disclaimer"]


# --------------------------------------------------------------------- API --
def test_api_roundtrip(settings, png_bytes):
    from fastapi.testclient import TestClient

    from trellis_service.api import create_app

    with TestClient(create_app(settings)) as client:
        health = client.get("/api/health").json()
        assert health["ok"] is True
        assert health["backend"] == "mock"

        response = client.post(
            "/api/generate",
            files={"image": ("photo.png", png_bytes, "image/png")},
            data={"seed": "3", "texture_size": "512"},
        )
        assert response.status_code == 202, response.text
        job_id = response.json()["id"]

        job = {}
        for _ in range(120):
            job = client.get(f"/api/jobs/{job_id}").json()
            if job["status"] in {"succeeded", "failed"}:
                break
            time.sleep(0.1)

        assert job["status"] == "succeeded", job
        assert job["stats"]["seed"] == 3
        assert job["files"]["glb"].startswith(f"/api/outputs/{job_id}/")

        glb = client.get(job["files"]["glb"])
        assert glb.status_code == 200
        assert glb.content[:4] == b"glTF"


def test_api_rejects_non_images(settings):
    from fastapi.testclient import TestClient

    from trellis_service.api import create_app

    with TestClient(create_app(settings)) as client:
        bad_type = client.post(
            "/api/generate", files={"image": ("notes.txt", b"hello", "text/plain")}
        )
        assert bad_type.status_code == 415

        corrupt = client.post(
            "/api/generate", files={"image": ("photo.png", b"not-a-png", "image/png")}
        )
        assert corrupt.status_code == 400


def test_api_unknown_job_and_traversal(settings):
    from fastapi.testclient import TestClient

    from trellis_service.api import create_app

    with TestClient(create_app(settings)) as client:
        assert client.get("/api/jobs/does-not-exist").status_code == 404
        assert client.get("/api/outputs/does-not-exist/model.glb").status_code == 404


def test_web_interface_is_served(settings):
    from fastapi.testclient import TestClient

    from trellis_service.api import create_app

    with TestClient(create_app(settings)) as client:
        page = client.get("/")
        assert page.status_code == 200
        assert "TRELLIS" in page.text
        assert client.get("/app.js").status_code == 200
        assert client.get("/vendor/three/build/three.module.js").status_code == 200


# ------------------------------------------------------------- job safety --
def test_delete_only_touches_its_own_directory(settings, png_bytes, tmp_path):
    from trellis_service.jobs import JobStore
    from trellis_service.runtime import build_runtime

    runtime = build_runtime(settings)
    store = JobStore(runtime, settings.output_dir, ttl_s=60)
    try:
        job = store.create("photo.png", GenOptions())
        store._run(job, png_bytes)
        work_dir = job.work_dir
        assert work_dir is not None and work_dir.is_dir()

        # a stray job record with no work dir must not delete the cwd
        canary = tmp_path / "canary.txt"
        canary.write_text("keep me")
        bogus = store.create("bogus.png", GenOptions())
        bogus.files["_work_dir"] = ""
        assert store.delete(bogus.id) is True
        assert canary.exists()

        assert store.delete(job.id) is True
        assert not work_dir.exists()
    finally:
        store.shutdown()
