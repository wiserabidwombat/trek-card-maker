"""Synthesise one clean base frame from a group of source frames."""

from __future__ import annotations

import numpy as np

Box = tuple[int, int, int, int]


def median_frame(frames: list[np.ndarray]) -> np.ndarray:
    return np.median(np.stack(frames).astype(np.float32), axis=0).astype(np.uint8)


def percentile_frame(frames: list[np.ndarray], q: float) -> np.ndarray:
    return np.percentile(np.stack(frames).astype(np.float32), q, axis=0).astype(np.uint8)


def fill_art_box(img: np.ndarray, bbox: Box, colour: tuple[int, int, int] = (15, 18, 22)) -> None:
    x0, y0, x1, y1 = bbox
    img[y0:y1, x0:x1, :3] = colour


def slot_rect(slot: dict, W: int, H: int, pad: float = 1.25) -> Box:
    r = slot["size"] * W / 2 * pad
    cx, cy = slot["cx"] * W, slot["cy"] * H
    return (max(0, int(cx - r)), max(0, int(cy - r)), min(W, int(cx + r) + 1), min(H, int(cy + r) + 1))


def socket_present(img: np.ndarray, slot: dict, W: int, H: int) -> bool:
    """A socket shows as a bright metallic ring around a disc whose content varies a lot."""
    r = slot["size"] * W / 2
    cx, cy = slot["cx"] * W, slot["cy"] * H
    x0, y0, x1, y1 = slot_rect(slot, W, H, pad=1.1)
    sub = img[y0:y1, x0:x1, :3].astype(np.float32)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ring = (d >= 0.82 * r) & (d <= 1.0 * r)
    inner = d <= 0.65 * r
    if not ring.any() or not inner.any():
        return False
    ring_bright = float(sub[ring].mean())
    inner_std = float(sub[inner].std())
    return ring_bright > 140 and inner_std > 20


def patch_slot(img: np.ndarray, slot: dict, W: int, H: int, donor: np.ndarray | None, step_px: int) -> str:
    """Replace the slot rectangle with the donor's pixels, or with the texture ``step_px`` below."""
    x0, y0, x1, y1 = slot_rect(slot, W, H)
    if donor is not None:
        img[y0:y1, x0:x1] = donor[y0:y1, x0:x1]
        return "donor"
    sy0, sy1 = y0 + step_px, y1 + step_px
    if sy1 > H:
        sy0, sy1 = y0 - step_px, y1 - step_px
    img[y0:y1, x0:x1] = img[sy0:sy1, x0:x1]
    return "shift"


def clean_strip(img: np.ndarray, band: Box, frames: list[np.ndarray], q: float = 25.0) -> None:
    """Replace ``band`` with the per-pixel ``q``-th percentile across ``frames`` (dark background wins)."""
    x0, y0, x1, y1 = band
    stack = np.stack([f[y0:y1, x0:x1] for f in frames]).astype(np.float32)
    img[y0:y1, x0:x1] = np.percentile(stack, q, axis=0).astype(np.uint8)
