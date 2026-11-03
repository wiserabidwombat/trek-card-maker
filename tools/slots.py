"""Measure icon sockets and the mission affiliation strip from pixel variance across frames.

Sockets exist only on cards that carry an icon there, so the per-pixel standard deviation across
a group of frames has a blob wherever a socket comes and goes.
"""

from __future__ import annotations

import numpy as np

from artmask import _majority3x3

Region = tuple[float, float, float, float]


def _varying(frames: list[np.ndarray], region: Region, threshold: float) -> tuple[np.ndarray, int, int, int, int]:
    h, w = frames[0].shape[:2]
    x0, y0, x1, y1 = (int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h))
    stack = np.stack([f[y0:y1, x0:x1, :3] for f in frames]).astype(np.float32)
    std = stack.std(axis=0).max(axis=2)
    return _majority3x3(std > threshold), x0, y0, w, h


def _runs(flags: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for i, on in enumerate(list(flags) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= min_len:
                runs.append((start, i))
            start = None
    return runs


def detect_slots(
    frames: list[np.ndarray],
    column: Region = (0.0, 0.52, 0.16, 0.95),
    threshold: float = 18.0,
    min_height: float = 0.03,
    row_fill: float = 0.12,
) -> list[dict]:
    """Return socket slots [{cx, cy, size}] (fractions; size relative to width), top to bottom."""
    mask, x0, y0, w, h = _varying(frames, column, threshold)
    rows = mask.mean(axis=1) > row_fill
    slots: list[dict] = []
    for r0, r1 in _runs(rows, int(min_height * h)):
        cols = mask[r0:r1].mean(axis=0) > row_fill
        col_runs = _runs(cols, 4)
        if not col_runs:
            continue
        c0, c1 = max(col_runs, key=lambda rc: rc[1] - rc[0])
        size = max(r1 - r0, c1 - c0)
        slots.append(
            {
                "cx": round((x0 + (c0 + c1) / 2) / w, 4),
                "cy": round((y0 + (r0 + r1) / 2) / h, 4),
                "size": round(size / w, 4),
            }
        )
    return slots


def detect_strip(
    frames: list[np.ndarray],
    band: Region = (0.0, 0.84, 1.0, 0.94),
    threshold: float = 18.0,
    col_fill: float = 0.08,
) -> dict | None:
    """Return {cy, step, size} for icons laid out horizontally in ``band``, centred on the card."""
    mask, x0, y0, w, h = _varying(frames, band, threshold)
    cols = mask.mean(axis=0) > col_fill
    col_runs = _runs(cols, 6)
    if not col_runs:
        return None
    centres = sorted((x0 + (c0 + c1) / 2) / w for c0, c1 in col_runs)
    widths = [(c1 - c0) / w for c0, c1 in col_runs]
    rows = mask.mean(axis=1) > col_fill
    row_runs = _runs(rows, 4)
    if row_runs:
        r0 = min(r for r, _ in row_runs)
        r1 = max(r for _, r in row_runs)
    else:
        r0, r1 = 0, mask.shape[0]
    gaps = [b - a for a, b in zip(centres, centres[1:]) if b - a > 0.02]
    step = float(np.median(gaps)) if gaps else 0.0
    return {
        "cy": round((y0 + (r0 + r1) / 2) / h, 4),
        "step": round(step, 4),
        "size": round(float(np.median(widths)), 4),
    }


def refine_slot(img: np.ndarray, slot: dict, pad: float = 1.3) -> dict:
    """Re-centre a slot on the bright metallic ring found inside its rectangle.

    Ring pixels are bright and grey (low channel spread). The centroid gives the centre and the
    95th-percentile distance the outer radius. The input slot is returned when too few ring
    pixels are found.
    """
    h, w = img.shape[:2]
    r = slot["size"] * w / 2 * pad
    cx, cy = slot["cx"] * w, slot["cy"] * h
    x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
    x1, y1 = min(w, int(cx + r) + 1), min(h, int(cy + r) + 1)
    sub = img[y0:y1, x0:x1, :3].astype(int)
    bright = sub.max(axis=2) > 150
    grey = (sub.max(axis=2) - sub.min(axis=2)) < 60
    yy, xx = np.mgrid[y0:y1, x0:x1]
    window = (xx - cx) ** 2 + (yy - cy) ** 2 <= (slot["size"] * w / 2 * 1.3) ** 2
    ys, xs = np.nonzero(bright & grey & window)
    if ys.size < 50:
        return dict(slot)
    ncx, ncy = x0 + xs.mean(), y0 + ys.mean()
    d = np.sqrt((x0 + xs - ncx) ** 2 + (y0 + ys - ncy) ** 2)
    radius = float(np.percentile(d, 95))
    return {"cx": round(float(ncx) / w, 4), "cy": round(float(ncy) / h, 4), "size": round(2 * radius / w, 4)}


def regularize_slots(slots: list[dict], max_slots: int = 4) -> list[dict]:
    """Snap slots to an even vertical step (the smallest gap found) and fill skipped positions."""
    if len(slots) < 2:
        return [dict(s) for s in slots]
    cys = sorted(s["cy"] for s in slots)
    gaps = [b - a for a, b in zip(cys, cys[1:])]
    step = min(gaps)
    cx = float(np.median([s["cx"] for s in slots]))
    size = float(np.median([s["size"] for s in slots]))
    out = []
    cy = cys[0]
    while cy <= cys[-1] + step * 0.25 and len(out) < max_slots:
        out.append({"cx": round(cx, 4), "cy": round(float(cy), 4), "size": round(size, 4)})
        cy += step
    return out


def measure_strip(blob_sets: list[list[tuple[int, int, int, int]]], W: int, H: int) -> dict | None:
    """From per-frame merged icon boxes, derive {cy, step, size} (size = median icon height / W)."""
    centres_y: list[float] = []
    heights: list[float] = []
    gaps: list[float] = []
    for boxes in blob_sets:
        xs = sorted((b[0] + b[2]) / 2 for b in boxes)
        for b in boxes:
            centres_y.append((b[1] + b[3]) / 2)
            heights.append(b[3] - b[1])
        gaps.extend(b - a for a, b in zip(xs, xs[1:]))
    if not centres_y:
        return None
    return {
        "cy": round(float(np.median(centres_y)) / H, 4),
        "step": round(float(np.median(gaps)) / W, 4) if gaps else 0.0,
        "size": round(float(np.median(heights)) / W, 4),
    }
