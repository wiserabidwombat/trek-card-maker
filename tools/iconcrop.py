"""Crop full-size icons out of frames: socket discs, socket rings and mission strip blobs."""

from __future__ import annotations

import numpy as np

Box = tuple[int, int, int, int]


def _disc_alpha(h: int, w: int, cx: float, cy: float, r: float, feather: float = 1.0) -> np.ndarray:
    yy, xx = np.mgrid[:h, :w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return np.clip((r - d) / feather + 0.5, 0, 1)


def crop_disc(img: np.ndarray, cx: float, cy: float, r: float) -> np.ndarray:
    """RGBA crop of the disc centred at (cx, cy) with radius r (pixels), transparent outside."""
    x0, y0 = int(np.floor(cx - r)), int(np.floor(cy - r))
    x1, y1 = int(np.ceil(cx + r)) + 1, int(np.ceil(cy + r)) + 1
    x0, y0 = max(0, x0), max(0, y0)
    sub = img[y0:y1, x0:x1, :3]
    h, w = sub.shape[:2]
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = sub
    out[..., 3] = (_disc_alpha(h, w, cx - x0, cy - y0, r) * 255).astype(np.uint8)
    return out


def crop_ring(img: np.ndarray, cx: float, cy: float, r_outer: float, r_inner: float) -> np.ndarray:
    """RGBA crop of the annulus between r_inner and r_outer; the centre is transparent."""
    out = crop_disc(img, cx, cy, r_outer)
    h, w = out.shape[:2]
    x0, y0 = int(np.floor(cx - r_outer)), int(np.floor(cy - r_outer))
    x0, y0 = max(0, x0), max(0, y0)
    inner = _disc_alpha(h, w, cx - x0, cy - y0, r_inner)
    out[..., 3] = (out[..., 3] * (1 - inner)).astype(np.uint8)
    return out


def sharpness(rgba: np.ndarray) -> float:
    """Variance of a 4-neighbour Laplacian on the grey channel, alpha-weighted."""
    g = rgba[..., :3].astype(np.float32).mean(axis=2)
    lap = np.zeros_like(g)
    lap[1:-1, 1:-1] = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    a = rgba[..., 3].astype(np.float32) / 255
    if a.sum() == 0:
        return 0.0
    return float(((lap**2) * a).sum() / a.sum())


def label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connected component labelling without SciPy (two-pass union-find)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    parent: list[int] = [0]

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for y in range(h):
        row = mask[y]
        for x in range(w):
            if not row[x]:
                continue
            up = labels[y - 1, x] if y else 0
            left = labels[y, x - 1] if x else 0
            if up and left:
                ru, rl = find(up), find(left)
                labels[y, x] = ru
                if ru != rl:
                    parent[rl] = ru
            elif up or left:
                labels[y, x] = up or left
            else:
                parent.append(len(parent))
                labels[y, x] = len(parent) - 1
    if len(parent) == 1:
        return labels, 0
    roots = np.array([find(i) for i in range(len(parent))])
    remap = np.zeros(len(parent), np.int32)
    uniq = sorted(set(roots[1:].tolist()))
    for i, r in enumerate(uniq, start=1):
        remap[roots == r] = i
    return remap[labels], len(uniq)


def strip_blobs(img: np.ndarray, band: Box, bright: int = 90, min_size: int = 12, pad: int = 2) -> list[Box]:
    """Bounding boxes (image coordinates) of bright blobs inside ``band`` = (x0, y0, x1, y1) px."""
    x0, y0, x1, y1 = band
    sub = img[y0:y1, x0:x1, :3].astype(int)
    mask = sub.max(axis=2) > bright
    labels, n = label_components(mask)
    boxes: list[Box] = []
    for k in range(1, n + 1):
        ys, xs = np.nonzero(labels == k)
        if ys.size == 0:
            continue
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if bw < min_size or bh < min_size:
            continue
        boxes.append(
            (
                max(0, x0 + xs.min() - pad),
                max(0, y0 + ys.min() - pad),
                min(img.shape[1], x0 + xs.max() + 1 + pad),
                min(img.shape[0], y0 + ys.max() + 1 + pad),
            )
        )
    return sorted(boxes)


def crop_box_rgba(img: np.ndarray, box: Box, dark: int = 40, feather: int = 2) -> np.ndarray:
    """Crop ``box`` with alpha from brightness: pixels darker than ``dark`` are transparent."""
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1, :3]
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = sub
    bright = sub.astype(int).max(axis=2)
    out[..., 3] = np.clip((bright - dark) * (255 // max(1, feather * 10)), 0, 255).astype(np.uint8)
    return out


def merge_boxes(boxes: list[Box], gap: int = 8) -> list[Box]:
    """Merge boxes whose x-ranges overlap or sit within ``gap`` px of each other."""
    merged: list[list[int]] = []
    for b in sorted(boxes):
        if merged and b[0] <= merged[-1][2] + gap:
            m = merged[-1]
            m[1], m[2], m[3] = min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3])
        else:
            merged.append(list(b))
    return [tuple(m) for m in merged]  # type: ignore[misc]


def tight_crop(rgba: np.ndarray, dark: int = 60, inner: float = 0.0) -> np.ndarray:
    """Crop ``rgba`` to the bounding box of its bright, opaque pixels.

    ``inner`` > 0 first clears alpha outside a circle of that radius (fraction of the size), which
    strips the metallic ring off a disc icon so only the emblem remains.
    """
    out = rgba.copy()
    h, w = out.shape[:2]
    if inner > 0:
        yy, xx = np.mgrid[:h, :w]
        c = (w - 1) / 2, (h - 1) / 2
        out[((xx - c[0]) ** 2 + (yy - c[1]) ** 2) > (inner * w) ** 2, 3] = 0
    bright = (out[..., :3].astype(int).max(axis=2) > dark) & (out[..., 3] > 0)
    ys, xs = np.nonzero(bright)
    if ys.size == 0:
        return out
    return out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
