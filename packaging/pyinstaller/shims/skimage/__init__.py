"""Minimal PyInstaller shim for the InsightFace dependencies."""

from . import io, transform

__all__ = ["io", "transform"]
