import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from drawn_icons import DRAWN_OTHER_ICONS, lower_decks_disc  # noqa: E402


def test_lower_decks_is_a_disc_of_the_requested_size():
    for size in (56, 76):
        disc = lower_decks_disc(size)
        assert disc.shape == (size, size, 4)
        assert disc.dtype == np.uint8
        # transparent corners, opaque centre
        assert disc[0, 0, 3] == 0 and disc[0, -1, 3] == 0 and disc[-1, 0, 3] == 0 and disc[-1, -1, 3] == 0
        assert disc[size // 2, size // 2, 3] == 255


def test_lower_decks_shows_a_ship_on_a_dark_disc():
    disc = lower_decks_disc(128).astype(int)
    rgb, a = disc[..., :3], disc[..., 3]
    lum = rgb.mean(axis=2)
    opaque = a == 255
    # the rim of the disc is dark navy
    ring = opaque & (np.hypot(*np.mgrid[0:128, 0:128] - 63.5) > 58)
    assert lum[ring].mean() < 40
    # the hull is light, and covers a fair part of the disc but not most of it
    hull = opaque & (lum > 150)
    assert 0.08 < hull.sum() / opaque.sum() < 0.5
    # warp grilles glow blue, the bussard caps are red and the saucer wears its orange band
    assert ((rgb[..., 2] > 180) & (rgb[..., 0] < 150) & opaque).any()
    assert ((rgb[..., 0] > 200) & (rgb[..., 1] < 120) & opaque).any()
    assert ((rgb[..., 0] > 190) & (rgb[..., 1] > 100) & (rgb[..., 1] < 170) & (rgb[..., 2] < 100) & opaque).any()


def test_drawing_is_deterministic_and_registered():
    assert np.array_equal(lower_decks_disc(56), lower_decks_disc(56))
    assert DRAWN_OTHER_ICONS["lower-decks"] is lower_decks_disc
