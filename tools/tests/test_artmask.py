import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from artmask import compute_art_mask, erase_red_dots  # noqa: E402


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


def test_edge_band_limits_overlay_and_bbox_can_be_given():
    H, W = 200, 140
    frames = []
    for seed in range(4):
        rng = np.random.default_rng(seed)
        f = np.full((H, W, 3), 90, np.uint8)
        f[20:100, 10:130] = rng.integers(0, 255, (80, 120, 3), np.uint8)
        f[55:65, 60:80] = 200  # constant blob deep inside the art
        f[20:24, 10:130] = 30  # constant strip along the top edge
        frames.append(f)
    bbox, overlay = compute_art_mask(frames, bbox=(10, 20, 130, 100), edge_band=0.15)
    assert bbox == (10, 20, 130, 100)
    assert overlay[60, 70, 3] == 0  # deep-inside constant pixels are not kept
    assert overlay[21, 70, 3] == 255  # edge strip is kept


def test_erase_red_dots_fills_with_neighbouring_texture():
    img = np.full((100, 200, 3), (210, 200, 180), np.uint8)
    img[:, ::2] = (200, 190, 170)  # faint vertical texture
    yy, xx = np.mgrid[0:100, 0:200]
    dot = (yy - 50) ** 2 + (xx - 60) ** 2 <= 36
    img[dot] = (200, 30, 30)
    n = erase_red_dots(img, (0.1, 0.2, 0.9, 0.8))
    assert n > 0
    assert not (((img[..., 0].astype(int) - img[..., 1]) > 60).any())
    assert tuple(img[50, 60]) in ((210, 200, 180), (200, 190, 170))


def test_erase_red_dots_ignores_regions_without_red():
    img = np.full((50, 50, 3), 100, np.uint8)
    assert erase_red_dots(img, (0, 0, 1, 1)) == 0
