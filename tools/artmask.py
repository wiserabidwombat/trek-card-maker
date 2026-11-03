"""Find the artwork rectangle of a card frame group by per-pixel variance across cards.

Frame pixels are identical across cards that share a frame; artwork pixels vary. Inside the
artwork bounding box, constant pixels belong to the frame (ragged edges, bars) and are kept in an
RGBA overlay drawn on top of the user's image.
"""

from __future__ import annotations

import numpy as np


def _majority3x3(mask: np.ndarray) -> np.ndarray:
    """Keep a pixel set when at least 5 of its 3x3 neighbourhood are set."""
    m = mask.astype(np.uint8)
    p = np.pad(m, 1)
    total = np.zeros_like(m, dtype=np.uint8)
    h, w = m.shape
    for dy in range(3):
        for dx in range(3):
            total += p[dy : dy + h, dx : dx + w]
    return total >= 5


def compute_art_mask(frames: list[np.ndarray], threshold: float = 14.0, top_fraction: float = 0.6):
    stack = np.stack(frames).astype(np.float32)
    std = stack.std(axis=0).max(axis=2)
    varying = _majority3x3(std > threshold)
    h, w = varying.shape
    limit = int(h * top_fraction)
    top = varying.copy()
    top[limit:, :] = False
    ys, xs = np.nonzero(top)
    if len(ys) == 0:
        raise ValueError("no varying region found")
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    bbox = (x0, y0, x1, y1)

    median = np.median(stack, axis=0).astype(np.uint8)
    overlay = np.zeros((h, w, 4), np.uint8)
    overlay[..., :3] = median
    frame_inside = np.zeros((h, w), bool)
    frame_inside[y0:y1, x0:x1] = ~varying[y0:y1, x0:x1]
    frame_inside = _majority3x3(frame_inside)
    frame_inside[:y0, :] = False
    frame_inside[y1:, :] = False
    frame_inside[:, :x0] = False
    frame_inside[:, x1:] = False
    overlay[..., 3] = np.where(frame_inside, 255, 0).astype(np.uint8)
    return bbox, overlay
