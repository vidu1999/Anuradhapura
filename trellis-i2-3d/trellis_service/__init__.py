"""Image-to-3D service built on microsoft/TRELLIS.

The vendored model code lives in ``vendor/TRELLIS``; everything in this package
is service plumbing around it (job queue, HTTP API, CLI, progress reporting).
"""

__version__ = "1.0.0"

__all__ = ["config", "generate", "jobs", "mock", "progress", "runtime"]
