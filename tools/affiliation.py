"""Affiliation inference from the colour of a frame's title bar strip."""

from __future__ import annotations

import math

import numpy as np

RGB = tuple[int, int, int]

# Sampling region as fractions of the frame: the title bar strip right of the icon.
STRIP = {"hires": (0.30, 0.03, 0.90, 0.06), "std": (0.30, 0.03, 0.90, 0.06)}

# Filled in after reviewing review/aff_*.png contact sheets (cluster centre -> name).
AFFILIATION_TABLE: dict[str, RGB] = {}


def sample_colour(img: np.ndarray, family: str) -> RGB:
    h, w = img.shape[:2]
    x0, y0, x1, y1 = STRIP[family]
    region = img[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w), :3]
    mean = region.reshape(-1, 3).mean(axis=0)
    return tuple(int(round(v)) for v in mean)  # type: ignore[return-value]


def _dist(a: RGB, b: RGB) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def nearest_affiliation(rgb: RGB, table: dict[str, RGB]) -> str:
    return min(table.items(), key=lambda kv: _dist(rgb, kv[1]))[0]


def cluster_colours(samples: list[RGB], tol: float = 28.0) -> list[tuple[RGB, list[int]]]:
    """Greedy clustering: each sample joins the first centre within ``tol`` else starts a cluster."""
    clusters: list[tuple[list[float], list[int]]] = []
    for i, s in enumerate(samples):
        for centre, members in clusters:
            if _dist(s, tuple(centre)) <= tol:  # type: ignore[arg-type]
                members.append(i)
                n = len(members)
                for k in range(3):
                    centre[k] += (s[k] - centre[k]) / n
                break
        else:
            clusters.append(([float(v) for v in s], [i]))
    return [((int(round(c[0])), int(round(c[1])), int(round(c[2]))), m) for c, m in clusters]
