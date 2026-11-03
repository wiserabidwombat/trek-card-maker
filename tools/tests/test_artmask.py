import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from artmask import compute_art_mask  # noqa: E402


def test_art_box_and_overlay():
    H, W = 200, 140
    frames = []
    for seed in range(4):
        rng = np.random.default_rng(seed)
        f = np.full((H, W, 3), 90, np.uint8)  # constant frame
        f[20:100, 10:130] = rng.integers(0, 255, (80, 120, 3), np.uint8)  # art varies
        f[60:70, 60:80] = 200  # constant frame bar inside the art area
        frames.append(f)
    bbox, overlay = compute_art_mask(frames)
    assert bbox == (10, 20, 130, 100)
    assert overlay.shape == (H, W, 4)
    assert overlay[65, 70, 3] == 255
    assert tuple(overlay[65, 70, :3]) == (200, 200, 200)
    assert overlay[30, 30, 3] == 0
    assert overlay[5, 5, 3] == 0


def test_bottom_half_variation_is_ignored():
    H, W = 200, 140
    frames = []
    for seed in range(3):
        rng = np.random.default_rng(seed)
        f = np.full((H, W, 3), 90, np.uint8)
        f[20:60, 10:130] = rng.integers(0, 255, (40, 120, 3), np.uint8)
        f[150:190, 10:130] = rng.integers(0, 255, (40, 120, 3), np.uint8)  # varying lower region
        frames.append(f)
    bbox, _ = compute_art_mask(frames)
    assert bbox == (10, 20, 130, 60)


def test_small_varying_icon_outside_art_is_ignored():
    H, W = 200, 140
    frames = []
    for seed in range(3):
        rng = np.random.default_rng(seed)
        f = np.full((H, W, 3), 90, np.uint8)
        f[5:15, 5:15] = rng.integers(0, 255, (10, 10, 3), np.uint8)  # varying type icon in title bar
        f[30:90, 10:130] = rng.integers(0, 255, (60, 120, 3), np.uint8)
        frames.append(f)
    bbox, _ = compute_art_mask(frames)
    assert bbox == (10, 30, 130, 90)
