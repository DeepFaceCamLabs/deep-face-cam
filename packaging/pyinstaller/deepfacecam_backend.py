#!/usr/bin/env python3
"""PyInstaller entry point for the macOS backend sidecar."""

from __future__ import annotations

import os
import sys
import types
import multiprocessing
from pathlib import Path


def _resource_root() -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(getattr(sys, "_MEIPASS")).resolve()
    return Path(__file__).resolve().parents[2]


def _prepend_path(path: Path) -> None:
    if path.exists():
        os.environ["PATH"] = str(path) + os.pathsep + os.environ.get("PATH", "")


def configure_runtime() -> None:
    root = _resource_root()
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    os.environ.setdefault(
        "DEEPFACECAM_MODEL_MANIFEST",
        str(root / "models" / "manifest.json"),
    )

    # Allow future bundled ffmpeg/ffprobe binaries without changing backend code.
    _prepend_path(root / "bin")
    _prepend_path(Path(sys.executable).resolve().parent / "bin")
    _prepend_path(Path(sys.executable).resolve().parent / "_internal" / "bin")

    # Avoid libraries trying to write config/cache files into the app bundle.
    cache_dir = os.environ.get("DEEPFACECAM_CACHE_DIR")
    if cache_dir:
        os.environ.setdefault("MPLCONFIGDIR", str(Path(cache_dir) / "matplotlib"))


def install_optional_dependency_stubs() -> None:
    """Satisfy optional InsightFace visualization imports in the sidecar."""
    matplotlib = types.ModuleType("matplotlib")
    pyplot = types.ModuleType("matplotlib.pyplot")

    class _NoopAxis:
        dist = 0

        def plot_trisurf(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def axis(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def view_init(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

    def subplot(*args, **kwargs):  # noqa: ANN002, ANN003
        return _NoopAxis()

    def title(*args, **kwargs):  # noqa: ANN002, ANN003
        return None

    pyplot.subplot = subplot
    pyplot.title = title
    matplotlib.pyplot = pyplot
    sys.modules.setdefault("matplotlib", matplotlib)
    sys.modules.setdefault("matplotlib.pyplot", pyplot)

    mpl_toolkits = types.ModuleType("mpl_toolkits")
    mplot3d = types.ModuleType("mpl_toolkits.mplot3d")
    mplot3d.Axes3D = type("Axes3D", (), {})
    sys.modules.setdefault("mpl_toolkits", mpl_toolkits)
    sys.modules.setdefault("mpl_toolkits.mplot3d", mplot3d)

    measure = types.ModuleType("skimage.measure")
    sys.modules.setdefault("skimage.measure", measure)

    mask_renderer = types.ModuleType("insightface.app.mask_renderer")

    class MaskRenderer:  # noqa: D101
        def __init__(self, *args, **kwargs):  # noqa: ANN002, ANN003
            raise RuntimeError("InsightFace mask rendering is not bundled")

    class MaskAugmentation:  # noqa: D101
        def __init__(self, *args, **kwargs):  # noqa: ANN002, ANN003
            raise RuntimeError("InsightFace mask augmentation is not bundled")

    mask_renderer.MaskRenderer = MaskRenderer
    mask_renderer.MaskAugmentation = MaskAugmentation
    sys.modules.setdefault("insightface.app.mask_renderer", mask_renderer)


def main() -> None:
    configure_runtime()
    install_optional_dependency_stubs()
    from modules.backend_server import main as backend_main

    backend_main()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
