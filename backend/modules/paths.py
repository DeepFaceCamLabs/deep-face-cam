"""Shared path constants for packaged and source-tree runtimes.

The backend source directory can be read-only in a packaged desktop app.
Runtime data such as models, outputs, uploads, caches, and preferences must
live in a platform app-data directory unless explicitly overridden.
"""

import os
import platform
from pathlib import Path

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_NAME = "DeepFaceCam"


def _expand(path: str) -> str:
    return os.path.abspath(os.path.expanduser(os.path.expandvars(path)))


def _default_data_dir() -> str:
    override = os.environ.get("DEEPFACECAM_DATA_DIR")
    if override:
        return _expand(override)

    system = platform.system()
    home = Path.home()
    if system == "Darwin":
        return str(home / "Library" / "Application Support" / APP_NAME)
    if system == "Windows":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return str(Path(base) / APP_NAME)
        return str(home / "AppData" / "Local" / APP_NAME)

    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return str(Path(xdg) / "deep-face-cam")
    return str(home / ".local" / "share" / "deep-face-cam")


def _path_from_env(name: str, fallback: str) -> str:
    value = os.environ.get(name)
    return _expand(value) if value else fallback


APP_DATA_DIR = _path_from_env("DEEPFACECAM_DATA_DIR", _default_data_dir())

# In source-tree development, keep using the existing in-repo model cache unless
# the native shell passes DEEPFACECAM_MODELS_DIR. Packaged builds should always
# pass that variable so the app bundle / Program Files remain read-only.
_DEV_MODELS_DIR = os.path.join(ROOT_DIR, "models")
MODELS_DIR = _path_from_env("DEEPFACECAM_MODELS_DIR", _DEV_MODELS_DIR)

OUTPUTS_DIR = _path_from_env(
    "DEEPFACECAM_OUTPUTS_DIR", os.path.join(APP_DATA_DIR, "outputs")
)
CACHE_DIR = _path_from_env(
    "DEEPFACECAM_CACHE_DIR", os.path.join(APP_DATA_DIR, "cache")
)
TEMP_DIR = _path_from_env("DEEPFACECAM_TEMP_DIR", os.path.join(CACHE_DIR, "temp"))
UPLOADS_DIR = _path_from_env(
    "DEEPFACECAM_UPLOADS_DIR", os.path.join(CACHE_DIR, "uploads")
)
SWITCH_STATE_PATH = _path_from_env(
    "DEEPFACECAM_SWITCH_STATE_PATH",
    os.path.join(APP_DATA_DIR, "switch_states.json"),
)


def ensure_runtime_dirs() -> None:
    for path in (APP_DATA_DIR, MODELS_DIR, OUTPUTS_DIR, CACHE_DIR, TEMP_DIR, UPLOADS_DIR):
        os.makedirs(path, exist_ok=True)
