import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from iconcrop import crop_disc, crop_ring, label_components, sharpness, strip_blobs  # noqa: E402


def _img(size=(80, 80), colour=(50, 60, 70)):
    a = np.zeros((size[0], size[1], 3), np.uint8)
    a[...] = colour
    return a


def test_crop_disc_alpha():
    out = crop_disc(_img(), 40, 40, 20)
    assert out.shape[2] == 4
    assert out[0, 0, 3] == 0
    h, w = out.shape[:2]
    assert out[h // 2, w // 2, 3] == 255


def test_crop_ring_centre_transparent():
    out = crop_ring(_img(), 40, 40, 20, 14)
    h, w = out.shape[:2]
    assert out[h // 2, w // 2, 3] == 0
    assert out[h // 2, 3, 3] > 200  # on the annulus


def test_strip_blobs_finds_two_squares():
    a = _img((60, 200), (5, 5, 10))
    a[20:40, 30:50] = (200, 200, 200)
    a[20:40, 120:150] = (180, 180, 180)
    boxes = strip_blobs(a, (0, 0, 200, 60))
    assert len(boxes) == 2
    assert boxes[0][0] <= 30 and boxes[0][2] >= 50
    assert boxes[1][0] <= 120 and boxes[1][2] >= 150


def test_label_components_counts():
    m = np.zeros((10, 10), bool)
    m[1:3, 1:3] = True
    m[6:9, 6:9] = True
    _labels, n = label_components(m)
    assert n == 2


def test_sharpness_prefers_detail():
    flat = np.zeros((32, 32, 4), np.uint8)
    flat[..., :3] = 120
    flat[..., 3] = 255
    checker = flat.copy()
    yy, xx = np.mgrid[:32, :32]
    checker[..., :3] = np.where(((xx // 4 + yy // 4) % 2)[..., None] == 0, 30, 220)
    assert sharpness(checker) > sharpness(flat)


def test_merge_boxes_joins_neighbours():
    from iconcrop import merge_boxes

    boxes = [(10, 0, 30, 10), (32, 2, 50, 12), (100, 0, 120, 10)]
    assert merge_boxes(boxes) == [(10, 0, 50, 12), (100, 0, 120, 10)]


def test_tight_crop_strips_ring():
    from iconcrop import tight_crop

    a = np.zeros((40, 40, 4), np.uint8)
    a[..., 3] = 255
    a[15:25, 15:25, :3] = 200  # emblem
    a[0:2, :, :3] = 220  # bright ring at the border
    out = tight_crop(a, inner=0.4)
    assert out.shape[:2] == (10, 10)
