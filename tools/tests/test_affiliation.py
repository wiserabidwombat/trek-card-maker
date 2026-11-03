import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from affiliation import cluster_colours, nearest_affiliation, sample_features  # noqa: E402


def test_nearest_prefers_family_table():
    t = {"hires:klingon": (150, 40, 40), "hires:federation": (40, 80, 160), "std:klingon": (10, 10, 10)}
    assert nearest_affiliation((140, 50, 45), t, "hires") == "klingon"
    assert nearest_affiliation((12, 12, 12), t, "std") == "klingon"
    assert nearest_affiliation((40, 80, 160), t) == "federation"


def test_cluster():
    cs = cluster_colours([(0, 0, 0), (5, 5, 5), (200, 200, 200), (195, 205, 200)], tol=28)
    assert len(cs) == 2
    assert sorted(len(m) for _, m in cs) == [2, 2]


def test_sample_features_three_regions():
    img = np.zeros((1000, 1000, 3), np.uint8)
    img[540:570, 150:380] = (10, 20, 30)
    img[890:915, 170:320] = (40, 50, 60)
    img[660:800, 30:60] = (70, 80, 90)
    assert sample_features(img, "std") == (10, 20, 30, 40, 50, 60, 70, 80, 90)
