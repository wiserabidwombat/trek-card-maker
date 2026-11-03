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
AFFILIATION_TABLE: dict[str, Vec] = {
    "hires:bajoran": (119, 85, 120, 103, 71, 106, 104, 77, 76),
    "hires:federation": (43, 177, 223, 8, 160, 207, 79, 112, 124),
    "hires:dominion": (139, 139, 145, 73, 52, 78, 73, 70, 78),
    "hires:cardassian": (107, 133, 171, 101, 124, 160, 68, 81, 101),
    "hires:starfleet": (43, 177, 224, 8, 160, 207, 80, 84, 96),
    "hires:romulan": (36, 124, 96, 3, 107, 73, 35, 65, 51),
    "hires:non-aligned": (223, 176, 87, 198, 151, 85, 135, 116, 81),
    "hires:ferengi": (216, 132, 51, 212, 139, 57, 185, 106, 54),
    "hires:klingon": (197, 54, 47, 189, 45, 44, 98, 48, 43),
    "hires:borg": (139, 150, 163, 119, 132, 150, 80, 88, 92),
    "hires:starfleet-ent": (74, 132, 184, 1, 99, 155, 64, 72, 89),
    "std:bajoran": (115, 82, 117, 101, 70, 105, 35, 25, 37),
    "std:borg": (135, 151, 149, 115, 128, 145, 46, 52, 58),
    "std:federation": (32, 168, 216, 8, 153, 197, 4, 55, 72),
    "std:ferengi": (223, 135, 53, 211, 138, 55, 66, 45, 22),
    "std:klingon": (195, 51, 46, 186, 44, 43, 56, 14, 14),
    "std:non-aligned": (216, 169, 84, 195, 147, 81, 68, 51, 22),
    "std:cardassian": (100, 127, 168, 97, 120, 157, 29, 37, 48),
    "std:dominion": (140, 141, 146, 74, 53, 79, 24, 17, 25),
    "std:romulan": (32, 112, 86, 1, 106, 72, 2, 35, 24),
    "std:starfleet-ent": (69, 126, 177, 0, 95, 150, 2, 34, 52),
    "std:federation-b": (58, 54, 54, 7, 158, 203, 10, 23, 29),
    "std:vidiian": (124, 119, 77, 147, 147, 60, 42, 37, 14),
}

# Clusters that are visual variants of the same affiliation.
AFFILIATION_ALIASES = {"starfleet-ent": "starfleet", "federation-b": "federation", "starfleet": "federation"}


def sample_features(img: np.ndarray, family: str) -> Vec:
    h, w = img.shape[:2]
    out: list[int] = []
    for x0, y0, x1, y1 in REGIONS[family]:
        region = img[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w), :3]
        out.extend(int(round(v)) for v in region.reshape(-1, 3).mean(axis=0))
    return tuple(out)


def _dist(a: Vec, b: Vec) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def nearest_cluster(vec: Vec, table: dict[str, Vec], family: str | None = None) -> str:
    """Raw table name (before aliasing) of the closest colour centre."""
    items = [(k, v) for k, v in table.items() if family is None or k.startswith(family + ":")]
    if not items:
        items = list(table.items())
    key = min(items, key=lambda kv: _dist(vec, kv[1]))[0]
    return key.split(":", 1)[-1]


def nearest_affiliation(vec: Vec, table: dict[str, Vec], family: str | None = None) -> str:
    name = nearest_cluster(vec, table, family)
    return AFFILIATION_ALIASES.get(name, name)


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
