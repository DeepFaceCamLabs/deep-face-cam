from __future__ import annotations

import subprocess
import sys
from typing import Any


def _hidden_window_kwargs(kwargs: dict[str, Any]) -> dict[str, Any]:
    """Prevent helper processes from opening console windows on Windows."""
    if sys.platform == "win32" and hasattr(subprocess, "CREATE_NO_WINDOW"):
        kwargs = dict(kwargs)
        kwargs["creationflags"] = int(kwargs.get("creationflags", 0)) | subprocess.CREATE_NO_WINDOW
    return kwargs


def popen(args: list[str], **kwargs: Any) -> subprocess.Popen:
    return subprocess.Popen(args, **_hidden_window_kwargs(kwargs))


def check_output(args: list[str], **kwargs: Any) -> bytes:
    return subprocess.check_output(args, **_hidden_window_kwargs(kwargs))


def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess:
    return subprocess.run(args, **_hidden_window_kwargs(kwargs))
