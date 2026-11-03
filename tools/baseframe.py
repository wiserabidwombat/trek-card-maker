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


def socket_bands(img: np.ndarray, slot: dict, W: int, H: int) -> tuple[float, float, float]:
    """(gap, ring, ring grey spread): mean brightness of the dark gap band (0.62-0.8 r) and of the
    metallic ring band (0.86-0.98 r), plus the ring band's mean channel spread. Measured on the
    HiRes sockets: the gap bottoms out near 0.75 r at ~10, the ring peaks near 0.94 r at ~165."""
    r = slot["size"] * W / 2
    cx, cy = slot["cx"] * W, slot["cy"] * H
    x0, y0, x1, y1 = slot_rect(slot, W, H, pad=1.1)
    sub = img[y0:y1, x0:x1, :3].astype(np.float32)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    gap = (d >= 0.62 * r) & (d < 0.8 * r)
    ring = (d >= 0.86 * r) & (d < 0.98 * r)
    if not gap.any() or not ring.any():
        return 255.0, 0.0, 255.0
    spread = sub.max(axis=2) - sub.min(axis=2)
    return float(sub[gap].mean()), float(sub[ring].mean()), float(spread[ring].mean())


def slot_diff(img: np.ndarray, slot: dict, W: int, H: int, clean_cy: float) -> float:
    """Mean absolute difference between the slot disc and the same disc at ``clean_cy`` (a spot on
    the column known to carry no socket). Plain texture differs little from itself; a socket a lot."""
    r = slot["size"] * W / 2 * 0.95
    cx = slot["cx"] * W

    def disc(cy: float) -> tuple[np.ndarray, np.ndarray]:
        x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
        x1, y1 = min(W, int(cx + r) + 1), min(H, int(cy + r) + 1)
        sub = img[y0:y1, x0:x1, :3].astype(np.float32)
        yy, xx = np.mgrid[y0:y1, x0:x1]
        return sub, (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r

    a, ma = disc(slot["cy"] * H)
    b, mb = disc(clean_cy * H)
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    m = ma[:h, :w] & mb[:h, :w]
    if not m.any():
        return 0.0
    return float(np.abs(a[:h, :w] - b[:h, :w])[m].mean())


def socket_present(img: np.ndarray, slot: dict, W: int, H: int, clean_cy: float | None = None) -> bool:
    """A socket is a metallic ring around a dark gap around an icon.

    With ``clean_cy`` the slot must also differ clearly from the clean column texture, which makes
    the test independent of the ring colour (silver, bronze or gold)."""
    gap, ring, _spread = socket_bands(img, slot, W, H)
    if clean_cy is None:
        return gap < 60 and ring > gap + 70
    return gap < 90 and ring > gap + 40 and slot_diff(img, slot, W, H, clean_cy) > 40


def patch_slot(img: np.ndarray, slot: dict, W: int, H: int, donor: np.ndarray | None, step_px: int) -> str:
    """Replace the slot rectangle with the donor's pixels, or with the texture ``step_px`` below."""
    x0, y0, x1, y1 = slot_rect(slot, W, H)
    if donor is not None:
        img[y0:y1, x0:x1] = donor[y0:y1, x0:x1]
        return "donor"
    sy0, sy1 = y0 + step_px, y1 + step_px
    if sy1 > H or sy0 < 0:
        sy0, sy1 = y0 - step_px, y1 - step_px
    img[y0:y1, x0:x1] = img[sy0:sy1, x0:x1].copy()
    return "shift"


def clean_strip(img: np.ndarray, band: Box, frames: list[np.ndarray], q: float = 25.0) -> None:
    """Replace ``band`` with the per-pixel ``q``-th percentile across ``frames`` (dark background wins)."""
    x0, y0, x1, y1 = band
    stack = np.stack([f[y0:y1, x0:x1] for f in frames]).astype(np.float32)
    img[y0:y1, x0:x1] = np.percentile(stack, q, axis=0).astype(np.uint8)
