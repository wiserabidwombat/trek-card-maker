import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pass3 import STD_CORNER_DISC, corner_disc, personnel_median  # noqa: E402


def _std_frame():
    """A standard-size black frame with a bright emblem at the corner-disc centre and a bracket arc outside it."""
    a = np.zeros((1039, 744, 3), np.uint8)
    cx, cy, r = STD_CORNER_DISC[0] * 744, STD_CORNER_DISC[1] * 1039, STD_CORNER_DISC[2] * 744
    a[int(cy) - 20 : int(cy) + 20, int(cx) - 20 : int(cx) + 20] = (200, 60, 120)
    a[int(cy) - 3 : int(cy) + 3, int(cx + r) + 12 : int(cx + r) + 30] = (220, 200, 120)  # arc, just outside the disc
    return a


def test_corner_disc_keeps_the_emblem_and_drops_what_lies_outside():
    disc = corner_disc(_std_frame(), "std")
    assert disc.shape[2] == 4
    h, w = disc.shape[:2]
    assert abs(w - 2 * STD_CORNER_DISC[2] * 744) <= 3
    assert disc[h // 2, w // 2, 3] == 255 and tuple(disc[h // 2, w // 2, :3]) == (200, 60, 120)
    # outside the disc both alpha and colour are zero, so a brightness-based alpha cannot bring the arc back
    assert disc[h // 2, w - 1, 3] == 0 and disc[h // 2, w - 1, :3].max() == 0
    assert disc[:, :, :3].max(axis=2)[disc[:, :, 3] < 128].max() == 0


def test_personnel_median_prefers_hires_and_falls_back_to_std():
    hires, std = np.zeros((2, 2, 3), np.uint8), np.ones((2, 2, 3), np.uint8)
    medians = {("personnel", "std", "vidiian"): std, ("personnel", "hires", "dominion"): hires, ("personnel", "std", "dominion"): std}
    assert personnel_median(medians, "dominion") == ("hires", hires)
    assert personnel_median(medians, "vidiian") == ("std", std)
    assert personnel_median(medians, "kazon") == (None, None)
