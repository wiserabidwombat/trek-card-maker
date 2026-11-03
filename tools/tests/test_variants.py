import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from variants import dilemma_variant, mission_variant, pick_family  # noqa: E402


def _img(blue_share, size=(100, 70)):
    """Dark image whose top-left type disc is ``blue_share`` bright blue."""
    a = np.zeros((size[0], size[1], 3), np.uint8)
    a[...] = (10, 10, 25)
    h, w = size
    x0, y0, x1, y1 = int(0.04 * w), int(0.03 * h), int(0.11 * w), int(0.08 * h)
    cut = y0 + int((y1 - y0) * blue_share)
    a[y0:cut, x0:x1] = (60, 170, 230)
    return a


def test_mission_variant():
    assert mission_variant(_img(0.9)) == "planet"
    assert mission_variant(_img(0.0)) == "space"
    assert mission_variant(_img(0.25)) == "headquarters"


def test_dilemma_variant():
    assert dilemma_variant(_img(0.25)) == "dual"
    assert dilemma_variant(_img(0.9)) == "planet"
    assert dilemma_variant(_img(0.0)) == "space"


def test_pick_family_prefers_hires():
    assert pick_family([{"family": "std"}, {"family": "hires"}]) == "hires"
    assert pick_family([{"family": "std"}]) == "std"
