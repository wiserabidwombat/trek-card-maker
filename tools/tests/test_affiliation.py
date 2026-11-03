import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from affiliation import cluster_colours, nearest_affiliation, sample_colour  # noqa: E402


def test_nearest():
    t = {"klingon": (150, 40, 40), "federation": (40, 80, 160)}
    assert nearest_affiliation((140, 50, 45), t) == "klingon"


def test_cluster():
    cs = cluster_colours([(0, 0, 0), (5, 5, 5), (200, 200, 200), (195, 205, 200)], tol=28)
    assert len(cs) == 2
    assert sorted(len(m) for _, m in cs) == [2, 2]


def test_sample_region():
    img = np.zeros((100, 100, 3), np.uint8)
    img[3:6, 30:90] = (10, 20, 30)
    assert sample_colour(img, "hires") == (10, 20, 30)
