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


def compute_art_mask(
    frames: list[np.ndarray],
    threshold: float = 14.0,
    top_fraction: float = 0.6,
    row_threshold: float = 0.3,
    col_threshold: float = 0.3,
    bbox: tuple[int, int, int, int] | None = None,
    edge_band: float = 0.0,
):
    """Return (bbox, overlay).

    ``bbox`` may be given to reuse a known art box (then only the overlay is computed).
    ``edge_band`` limits the overlay to pixels within that fraction of the box width/height
    from its edges, which is where frame elements (ragged edges, bars) intrude on the art.
    """
    stack = np.stack(frames).astype(np.float32)
    std = stack.std(axis=0).max(axis=2)
    varying = _majority3x3(std > threshold)
    h, w = varying.shape
    if bbox is None:
        limit = int(h * top_fraction)
        top = varying[:limit, :]
        # Rows that are mostly varying belong to the artwork; small varying icons elsewhere are ignored.
        row_frac = top.mean(axis=1)
        rows = np.nonzero(row_frac > row_threshold)[0]
        if len(rows) == 0:
            raise ValueError("no varying region found")
        y0, y1 = int(rows.min()), int(rows.max()) + 1
        col_frac = top[y0:y1, :].mean(axis=0)
        cols = np.nonzero(col_frac > col_threshold)[0]
        x0, x1 = int(cols.min()), int(cols.max()) + 1
        bbox = (x0, y0, x1, y1)
    x0, y0, x1, y1 = bbox

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
    if edge_band > 0:
        bx = int((x1 - x0) * edge_band)
        by = int((y1 - y0) * edge_band)
        inner = np.zeros((h, w), bool)
        inner[y0 + by : y1 - by, x0 + bx : x1 - bx] = True
        frame_inside &= ~inner
    overlay[..., 3] = np.where(frame_inside, 255, 0).astype(np.uint8)
    return bbox, overlay
