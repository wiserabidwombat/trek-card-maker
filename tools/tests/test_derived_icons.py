import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from derived_icons import gamma_from_delta  # noqa: E402


def _delta_icon(w=31):
    """A silver ring around a green disc with a white outlined delta, like the harvested icon."""
    arr = np.zeros((w, w, 4), np.uint8)
    yy, xx = np.indices((w, w))
    c = (w - 1) / 2
    r = np.hypot(xx - c, yy - c)
    arr[r <= w / 2] = (185, 190, 192, 255)
    arr[r <= 0.36 * w] = (60, 90, 45, 255)
    top, bottom, half = 7, 21, 6
    for y in range(top, bottom + 1):
        span = (y - top) / (bottom - top) * half
        arr[y, int(round(c - span)), :3] = 255
        arr[y, int(round(c + span)), :3] = 255
    arr[bottom, int(c - half) : int(c + half) + 1, :3] = 255
    return arr


def test_gamma_keeps_the_ring_paints_out_the_delta_and_draws_a_gamma():
    delta = _delta_icon()
    gamma = gamma_from_delta(delta)
    w = delta.shape[1]
    yy, xx = np.indices(delta.shape[:2])
    outside = np.hypot(xx - 15, yy - 15) > 0.36 * w + 1
    assert np.array_equal(gamma[outside], delta[outside])
    assert (gamma[..., 3][np.hypot(xx - 15, yy - 15) <= 0.36 * w] == 255).all()  # no hole where the delta was
    white = gamma[..., :3].min(axis=2) > 200
    assert not white[21, 14:21].any()  # the delta's base is gone
    assert not white[14:21, 19:22].any()  # and its right leg
    assert white[8, 11:19].all()  # the gamma's top bar
    assert white[9:22, 11].all()  # and its stem
    assert gamma[21, 16, 1] > gamma[21, 16, 0]  # painted-out pixels took the disc's green
