"""UI shim used by the headless backend server.

`modules.core` imports `modules.ui` and calls a few functions on it
(`update_status`, `check_and_ignore_nsfw`, `init`). When the new
TypeScript/React front-end is in charge we still need those symbols to
exist, but they should not start a Qt application or block on a Qt
event loop.

This module replaces `modules.ui` in `sys.modules` BEFORE any code that
imports `modules.ui` is loaded. It forwards status updates to a callback
that the backend server registers.
"""

from __future__ import annotations

from typing import Callable, Optional

import numpy as np

import modules.globals


# ─── status routing ──────────────────────────────────────────────────────

_status_sink: Optional[Callable[[str], None]] = None


def set_status_sink(sink: Optional[Callable[[str], None]]) -> None:
    """Register a function that receives every status line."""
    global _status_sink
    _status_sink = sink


def update_status(text: str) -> None:
    """Called by `modules.core` (and elsewhere) on every status line."""
    if _status_sink is not None:
        try:
            _status_sink(text)
        except Exception as exc:  # never let UI errors break processing
            print(f"[backend_ui_shim] status sink failed: {exc}")
    else:
        print(f"[STATUS] {text}")


# ─── NSFW gate (same semantics as PySide6 ui) ────────────────────────────


def check_and_ignore_nsfw(target, destroy: Optional[Callable] = None) -> bool:
    from modules.predicter import predict_frame, predict_image, predict_video
    from modules.utilities import has_image_extension

    check_nsfw = None
    if isinstance(target, str):
        check_nsfw = predict_image if has_image_extension(target) else predict_video
    elif isinstance(target, np.ndarray):
        check_nsfw = predict_frame

    if check_nsfw and check_nsfw(target):
        if destroy:
            destroy(to_quit=False)
        update_status("Processing ignored!")
        return True
    return False


# ─── inert init / mainloop ───────────────────────────────────────────────


class _Window:
    def mainloop(self) -> None:
        # Headless: do nothing. The backend server owns the event loop.
        return


def init(start, destroy, lang: str) -> _Window:  # noqa: ARG001
    return _Window()
