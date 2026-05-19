"""Tiny subset of skimage.io used by optional InsightFace 3D helpers."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def imread(path: str | Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise OSError(f"Could not read image: {path}")
    if image.ndim == 3 and image.shape[2] >= 3:
        image[..., :3] = image[..., 2::-1]
    return image


def imsave(path: str | Path, image: np.ndarray, *args, **kwargs) -> None:  # noqa: ARG001
    array = np.asarray(image)
    if array.ndim == 3 and array.shape[2] >= 3:
        array = array.copy()
        array[..., :3] = array[..., 2::-1]
    if not cv2.imwrite(str(path), array):
        raise OSError(f"Could not write image: {path}")
