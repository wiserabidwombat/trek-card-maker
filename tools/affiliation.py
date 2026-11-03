"""Affiliation inference from frame colours sampled in three regions.

Features are the mean RGB of three regions (type bar left part, first attribute box, left border
next to the game text), concatenated into a 9-value vector. Tables are per family because the
older (std) and HiRes frames are coloured differently.
"""

from __future__ import annotations

import math

import numpy as np

Vec = tuple[int, ...]

REGIONS = {
    "hires": [(0.15, 0.535, 0.38, 0.572), (0.14, 0.91, 0.32, 0.94), (0.03, 0.66, 0.06, 0.80)],
    "std": [(0.15, 0.54, 0.38, 0.57), (0.17, 0.89, 0.32, 0.915), (0.03, 0.66, 0.06, 0.80)],
}

# Filled in after reviewing review/aff_<family>_<k>.png: "<family>:<name>" -> 9-value centre.
AFFILIATION_TABLE: dict[str, Vec] = {}


def sample_features(img: np.ndarray, family: str) -> Vec:
    h, w = img.shape[:2]
    out: list[int] = []
    for x0, y0, x1, y1 in REGIONS[family]:
        region = img[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w), :3]
        out.extend(int(round(v)) for v in region.reshape(-1, 3).mean(axis=0))
    return tuple(out)


def _dist(a: Vec, b: Vec) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def nearest_affiliation(vec: Vec, table: dict[str, Vec], family: str | None = None) -> str:
    items = [(k, v) for k, v in table.items() if family is None or k.startswith(family + ":")]
    if not items:
        items = list(table.items())
    key = min(items, key=lambda kv: _dist(vec, kv[1]))[0]
    return key.split(":", 1)[-1]


def cluster_colours(samples: list[Vec], tol: float = 28.0) -> list[tuple[Vec, list[int]]]:
    """Greedy clustering: each sample joins the first centre within ``tol`` else starts a cluster."""
    clusters: list[tuple[list[float], list[int]]] = []
    for i, s in enumerate(samples):
        for centre, members in clusters:
            if _dist(s, tuple(centre)) <= tol:  # type: ignore[arg-type]
                members.append(i)
                n = len(members)
                for k in range(len(centre)):
                    centre[k] += (s[k] - centre[k]) / n
                break
        else:
            clusters.append(([float(v) for v in s], [i]))
    return [(tuple(int(round(v)) for v in c), m) for c, m in clusters]
