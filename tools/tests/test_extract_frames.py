import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from extract_frames import _knock_out_background  # noqa: E402


def _ringed_icon(bg=(255, 255, 255)):
    """A 21x21 icon on a flat background: a grey ring with a dot of the background colour at its centre."""
    arr = np.zeros((21, 21, 3), np.uint8)
    arr[...] = bg
    yy, xx = np.indices((21, 21))
    r = np.hypot(xx - 10, yy - 10)
    arr[(r >= 6) & (r <= 8)] = (120, 120, 120)
    arr[r < 6] = (30, 90, 30)
    arr[9:12, 9:12] = bg
    return Image.fromarray(arr, "RGB").convert("RGBA")


def test_knock_out_only_removes_background_that_touches_the_border():
    out = np.asarray(_knock_out_background(_ringed_icon()))
    assert out[0, 0, 3] == 0 and out[20, 20, 3] == 0
    assert out[10, 3, 3] == 255  # the ring
    assert out[10, 10, 3] == 255  # the white dot inside the ring keeps its colour and stays opaque
    assert tuple(out[10, 10, :3]) == (255, 255, 255)


def test_knock_out_leaves_icons_without_a_flat_background_alone():
    img = _ringed_icon()
    arr = np.array(img)
    arr[0, 0, :3] = (0, 0, 0)
    out = np.asarray(_knock_out_background(Image.fromarray(arr, "RGBA")))
    assert (out[..., 3] == 255).all()
