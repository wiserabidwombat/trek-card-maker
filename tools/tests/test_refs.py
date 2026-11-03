import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from refs import circular_mask, match_label, nearest_reference  # noqa: E402


def _disc(colour, size=40):
    a = np.zeros((size, size, 4), np.uint8)
    a[..., :3] = colour
    a[..., 3] = 255
    return a


def test_nearest_reference_picks_closest_colour():
    refs = {"red": _disc((220, 30, 30)), "blue": _disc((30, 30, 220))}
    name, dist = nearest_reference(_disc((200, 40, 40), 60), refs)
    assert name == "red"
    assert dist < 40


def test_circular_mask_ignores_corners():
    m = circular_mask(32)
    assert not m[0, 0]
    assert m[16, 16]


def test_match_label_multiword_and_punctuation():
    mapping = {"The Next Generation": "next-generation", "Starfleet": "starfleet", "Borg": "borg"}
    assert match_label(["The", "Next", "Generation"], mapping) == "next-generation"
    assert match_label(["Starfleet,", "and"], mapping) == "starfleet"
    assert match_label(["Borg,", "Cardassian,"], mapping) == "borg"
    assert match_label(["Cardassian,", "Borg"], mapping) is None
