"""Tiny subset of skimage.transform used by insightface.utils.face_align."""

from __future__ import annotations

import math

import cv2
import numpy as np


class SimilarityTransform:
    def __init__(
        self,
        scale: float | None = None,
        rotation: float | None = None,
        translation: tuple[float, float] | None = None,
        matrix: np.ndarray | None = None,
    ):
        if matrix is not None:
            self.params = np.asarray(matrix, dtype=np.float64)
            return

        s = 1.0 if scale is None else float(scale)
        r = 0.0 if rotation is None else float(rotation)
        tx, ty = translation if translation is not None else (0.0, 0.0)
        c = math.cos(r) * s
        sn = math.sin(r) * s
        self.params = np.array(
            [
                [c, -sn, float(tx)],
                [sn, c, float(ty)],
                [0.0, 0.0, 1.0],
            ],
            dtype=np.float64,
        )

    def estimate(self, src, dst) -> bool:
        src_arr = np.asarray(src, dtype=np.float32)
        dst_arr = np.asarray(dst, dtype=np.float32)
        matrix, _ = cv2.estimateAffinePartial2D(src_arr, dst_arr, method=cv2.LMEDS)
        if matrix is None:
            return False
        self.params = np.vstack([matrix, np.array([0.0, 0.0, 1.0])]).astype(np.float64)
        return True

    def __add__(self, other: "SimilarityTransform") -> "SimilarityTransform":
        return SimilarityTransform(matrix=np.matmul(other.params, self.params))
