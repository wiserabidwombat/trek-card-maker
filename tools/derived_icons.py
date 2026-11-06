"""Inline icons derived from harvested ones.

The Gamma Quadrant mark appears on none of the Second Edition source sets in hand, while the Delta
Quadrant mark does; both are a white Greek capital on the same green disc inside the silver ring, so
the gamma icon is the delta icon with the delta painted out and a gamma drawn in its place.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

GLYPH_MIN = 170  # a glyph pixel: every channel at least this bright (the glyph is white)
DISC_R = 0.36  # the green disc inside the ring, as a fraction of the icon width
CAP = 0.48  # glyph cap height as a fraction of the icon width (measured on the harvested delta)
BAR = 0.30  # width of the gamma's top bar
STROKE = 0.07  # stroke width of the gamma
SUPERSAMPLE = 8


def gamma_from_delta(delta: np.ndarray) -> np.ndarray:
    """RGBA Gamma Quadrant icon built from the RGBA Delta Quadrant icon (same size, ring untouched)."""
    out = delta.astype(np.float64).copy()
    h, w = out.shape[:2]
    cx, cy = (w - 1) / 2, (h - 1) / 2
    yy, xx = np.indices((h, w))
    disc = np.hypot(xx - cx, yy - cy) <= DISC_R * w
    glyph = disc & ((out[..., :3].min(axis=2) > GLYPH_MIN) | (out[..., 3] < 128))
    _inpaint(out, glyph, disc & ~glyph)
    mask = _gamma_mask(w, h, cx, cy)[..., None]
    out[..., :3] = out[..., :3] * (1 - mask) + 255 * mask
    out[..., 3] = np.maximum(out[..., 3], mask[..., 0] * 255)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def _inpaint(arr: np.ndarray, todo: np.ndarray, known: np.ndarray) -> None:
    """Fill the ``todo`` pixels from the mean of the ``known`` pixels within two pixels, working inwards."""
    h, w = todo.shape
    todo, known = todo.copy(), known.copy()
    while todo.any():
        filled = []
        for y, x in zip(*np.nonzero(todo)):
            y0, y1, x0, x1 = max(0, y - 2), min(h, y + 3), max(0, x - 2), min(w, x + 3)
            win = known[y0:y1, x0:x1]
            if win.any():
                arr[y, x, :3] = arr[y0:y1, x0:x1][win][:, :3].mean(axis=0)
                arr[y, x, 3] = 255
                filled.append((y, x))
        if not filled:
            return
        for y, x in filled:
            known[y, x], todo[y, x] = True, False


def _gamma_mask(w: int, h: int, cx: float, cy: float) -> np.ndarray:
    """Coverage (0..1) of a Greek capital gamma centred on (cx, cy): a stem and a top bar."""
    s = SUPERSAMPLE
    cap, bar, stroke = CAP * w, BAR * w, STROKE * w
    left, top = cx - bar / 2, cy - cap / 2
    big = Image.new("L", (w * s, h * s), 0)
    d = ImageDraw.Draw(big)
    d.rectangle([left * s, top * s, (left + stroke) * s, (top + cap) * s], fill=255)
    d.rectangle([left * s, top * s, (left + bar) * s, (top + stroke) * s], fill=255)
    return np.asarray(big.resize((w, h), Image.LANCZOS)).astype(np.float64) / 255
