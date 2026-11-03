"""Frame variants that are not affiliations: mission type and dilemma type, read from the
colour of the top-left ring, plus the family choice for a base frame."""

from __future__ import annotations

import numpy as np

# Fractions of width/height: the disc inside the top-left ring, shared by missions and dilemmas.
# A planet shows a bright blue globe, space a dark starfield, dual (dilemma) or headquarters
# (mission) a mix.
TYPE_DISC = (0.04, 0.03, 0.11, 0.08)
BLUE_PLANET, BLUE_SPACE = 0.45, 0.08


def region_mean(img: np.ndarray, region: tuple[float, float, float, float]) -> tuple[float, float, float]:
    h, w = img.shape[:2]
    x0, y0, x1, y1 = (int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h))
    sub = img[y0:y1, x0:x1, :3].reshape(-1, 3).astype(float)
    r, g, b = sub.mean(axis=0)
    return float(r), float(g), float(b)


def blue_fraction(img: np.ndarray, region: tuple[float, float, float, float] = TYPE_DISC) -> float:
    h, w = img.shape[:2]
    x0, y0, x1, y1 = (int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h))
    sub = img[y0:y1, x0:x1, :3].reshape(-1, 3).astype(int)
    blue = (sub[:, 2] > 140) & (sub[:, 2] > sub[:, 0] + 50)
    return float(blue.mean())


def mission_variant(img: np.ndarray) -> str:
    b = blue_fraction(img)
    return "planet" if b > BLUE_PLANET else "space" if b < BLUE_SPACE else "headquarters"


def dilemma_variant(img: np.ndarray) -> str:
    b = blue_fraction(img)
    return "planet" if b > BLUE_PLANET else "space" if b < BLUE_SPACE else "dual"


def pick_family(members: list[dict]) -> str:
    return "hires" if any(m.get("family") == "hires" for m in members) else "std"
