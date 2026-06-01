import sys
from typing import Any

from tqdm import tqdm as _tqdm


class _NullProgressFile:
    def write(self, _: str) -> int:
        return 0

    def flush(self) -> None:
        return None

    def isatty(self) -> bool:
        return False


_NULL_PROGRESS_FILE = _NullProgressFile()


def tqdm(*args: Any, **kwargs: Any) -> Any:
    """Create a tqdm progress bar that is safe in windowed app bundles.

    PyInstaller/windowed Windows apps can run with sys.stderr/sys.stdout set to
    None. Plain tqdm writes to stderr by default and crashes with
    "'NoneType' object has no attribute 'write'", which breaks video processing.
    """
    if kwargs.get("file") is None:
        stream = getattr(sys, "stderr", None) or getattr(sys, "stdout", None)
        if stream is None or not hasattr(stream, "write"):
            kwargs["file"] = _NULL_PROGRESS_FILE
            kwargs.setdefault("disable", True)
        else:
            kwargs["file"] = stream
    return _tqdm(*args, **kwargs)
