import sys
import time
from typing import Any, Callable, Dict, Optional

from tqdm import tqdm as _tqdm


class _NullProgressFile:
    def write(self, _: str) -> int:
        return 0

    def flush(self) -> None:
        return None

    def isatty(self) -> bool:
        return False


_NULL_PROGRESS_FILE = _NullProgressFile()
_progress_sink: Optional[Callable[[Dict[str, Any]], None]] = None


def set_progress_sink(sink: Optional[Callable[[Dict[str, Any]], None]]) -> None:
    global _progress_sink
    _progress_sink = sink


class _ProgressProxy:
    def __init__(self, bar: Any):
        self._bar = bar
        self._start = time.monotonic()
        self._last_emit = 0.0
        self._closed = False
        self._emit("start", force=True)

    def __enter__(self) -> "_ProgressProxy":
        self._bar.__enter__()
        self._emit("start", force=True)
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> Any:
        self._emit("done", force=True)
        return self._bar.__exit__(exc_type, exc, tb)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._bar, name)

    def update(self, n: int = 1) -> Any:
        result = self._bar.update(n)
        self._emit("update")
        return result

    def close(self) -> None:
        if not self._closed:
            self._emit("done", force=True)
            self._closed = True
        self._bar.close()

    def _emit(self, phase: str, force: bool = False) -> None:
        sink = _progress_sink
        if sink is None:
            return
        now = time.monotonic()
        total = getattr(self._bar, "total", None)
        current = getattr(self._bar, "n", 0)
        ratio = None
        if isinstance(total, (int, float)) and total > 0:
            ratio = min(1.0, max(0.0, float(current) / float(total)))
        if not force and now - self._last_emit < 0.25 and ratio != 1.0:
            return
        self._last_emit = now
        try:
            sink(
                {
                    "phase": phase,
                    "desc": getattr(self._bar, "desc", None) or "Processing",
                    "unit": getattr(self._bar, "unit", None),
                    "current": int(current or 0),
                    "total": int(total) if isinstance(total, (int, float)) and total >= 0 else None,
                    "ratio": ratio,
                    "elapsed": round(now - self._start, 2),
                }
            )
        except Exception:
            pass


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
    bar = _tqdm(*args, **kwargs)
    if _progress_sink is None:
        return bar
    return _ProgressProxy(bar)
