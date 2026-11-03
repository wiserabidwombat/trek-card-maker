import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from baseframe import clean_strip, fill_art_box, median_frame, patch_slot, socket_present  # noqa: E402

H, W = 300, 200


def _blank(colour=(80, 90, 100)):
    a = np.zeros((H, W, 3), np.uint8)
    a[...] = colour
    return a


def _socket(a, cx, cy, r):
    """Grey ring (0.82-1.0 r) around a black gap (0.6-0.82 r) around a coloured icon."""
    yy, xx = np.mgrid[:H, :W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a[d < 0.6 * r] = (200, 170, 40)
    a[(d >= 0.6 * r) & (d < 0.84 * r)] = (10, 10, 10)
    a[(d >= 0.84 * r) & (d <= r)] = (190, 190, 195)


def test_median_removes_sparse_sockets():
    frames = [_blank() for _ in range(5)]
    _socket(frames[0], 30, 150, 15)
    _socket(frames[1], 30, 150, 15)
    med = median_frame(frames)
    assert tuple(med[150, 30]) == (80, 90, 100)


def test_socket_present_detects_ring():
    a = _blank()
    slot = {"cx": 30 / W, "cy": 150 / H, "size": 30 / W}
    assert not socket_present(a, slot, W, H)
    light = _blank((180, 185, 190))  # plain light column texture
    assert not socket_present(light, slot, W, H)
    _socket(a, 30, 150, 15)
    assert socket_present(a, slot, W, H)


def test_socket_present_with_clean_reference_ignores_ring_colour():
    from baseframe import slot_diff

    a = _blank((120, 110, 100))
    slot = {"cx": 30 / W, "cy": 150 / H, "size": 30 / W}
    clean = 230 / H
    assert slot_diff(a, slot, W, H, clean) < 1
    assert not socket_present(a, slot, W, H, clean)
    _socket(a, 30, 150, 15)
    yy, xx = np.mgrid[:H, :W]
    d = np.sqrt((xx - 30) ** 2 + (yy - 150) ** 2)
    a[(d >= 12.6) & (d <= 15)] = (150, 110, 60)  # bronze ring
    assert slot_diff(a, slot, W, H, clean) > 40
    assert socket_present(a, slot, W, H, clean)


def test_patch_slot_from_donor_and_shift():
    a = _blank()
    _socket(a, 30, 150, 15)
    slot = {"cx": 30 / W, "cy": 150 / H, "size": 30 / W}
    donor = _blank((10, 20, 30))
    assert patch_slot(a, slot, W, H, donor, 40) == "donor"
    assert tuple(a[150, 30]) == (10, 20, 30)
    b = _blank()
    _socket(b, 30, 150, 15)
    b[180:230, :] = (1, 2, 3)
    assert patch_slot(b, slot, W, H, None, 40) == "shift"
    assert tuple(b[150, 30]) == (1, 2, 3)


def test_fill_art_box_and_clean_strip():
    a = _blank()
    fill_art_box(a, (10, 10, 50, 50), (1, 1, 1))
    assert tuple(a[20, 20]) == (1, 1, 1)
    frames = [_blank((5, 5, 10)) for _ in range(4)]
    frames[0][250:270, 90:110] = (200, 200, 200)
    target = frames[0].copy()
    clean_strip(target, (0, 240, W, 280), frames)
    assert tuple(target[260, 100]) == (5, 5, 10)
