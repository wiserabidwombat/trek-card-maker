import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pass3 import STD_CORNER_DISC, classify_quadrant, corner_disc, corner_emblems, corner_fill, personnel_median, quadrant_badges  # noqa: E402


def _std_frame():
    """A standard-size black frame with a bright emblem at the corner-disc centre and a bracket arc outside it."""
    a = np.zeros((1039, 744, 3), np.uint8)
    cx, cy, r = STD_CORNER_DISC[0] * 744, STD_CORNER_DISC[1] * 1039, STD_CORNER_DISC[2] * 744
    a[int(cy) - 20 : int(cy) + 20, int(cx) - 20 : int(cx) + 20] = (200, 60, 120)
    a[int(cy) - 3 : int(cy) + 3, int(cx + r) + 12 : int(cx + r) + 30] = (220, 200, 120)  # arc, just outside the disc
    return a


def test_corner_disc_keeps_the_emblem_and_drops_what_lies_outside():
    disc = corner_disc(_std_frame(), "std")
    assert disc.shape[2] == 4
    h, w = disc.shape[:2]
    assert abs(w - 2 * STD_CORNER_DISC[2] * 744) <= 3
    assert disc[h // 2, w // 2, 3] == 255 and tuple(disc[h // 2, w // 2, :3]) == (200, 60, 120)
    # outside the disc both alpha and colour are zero, so a brightness-based alpha cannot bring the arc back
    assert disc[h // 2, w - 1, 3] == 0 and disc[h // 2, w - 1, :3].max() == 0
    assert disc[:, :, :3].max(axis=2)[disc[:, :, 3] < 128].max() == 0


def test_personnel_median_prefers_hires_and_falls_back_to_std():
    hires, std = np.zeros((2, 2, 3), np.uint8), np.ones((2, 2, 3), np.uint8)
    medians = {("personnel", "std", "vidiian"): std, ("personnel", "hires", "dominion"): hires, ("personnel", "std", "dominion"): std}
    assert personnel_median(medians, "dominion") == ("hires", hires)
    assert personnel_median(medians, "vidiian") == ("std", std)
    assert personnel_median(medians, "kazon") == (None, None)


def test_classify_quadrant_by_disc_colour():
    assert classify_quadrant((22, 52, 63)) == "A"
    assert classify_quadrant((33, 44, 22)) == "D"
    assert classify_quadrant((75, 26, 14)) == "G"
    assert classify_quadrant((0, 0, 0)) is None


def _mission_frame(colour, w=200, h=280, spec=(0.1, 0.5, 0.05)):
    """A dark frame with a badge disc of one colour, a white letter stroke through its middle."""
    arr = np.zeros((h, w, 3), np.uint8)
    arr[...] = (10, 10, 10)
    yy, xx = np.indices((h, w))
    r = np.hypot(xx - spec[0] * w, yy - spec[1] * h)
    arr[r <= spec[2] * w] = colour
    arr[(r <= spec[2] * w) & (abs(xx - spec[0] * w) < 1.5)] = (255, 255, 255)
    return arr


def test_quadrant_badges_groups_missions_by_colour_and_measures_the_fill():
    frames = [
        {"type": "mission", "family": "std", "sourceTitle": "Earth Orbit"},
        {"type": "mission", "family": "std", "sourceTitle": "Wadi Homeworld"},
        {"type": "mission", "family": "std", "sourceTitle": "Founders' Homeworld"},
        {"type": "personnel", "family": "std", "sourceTitle": "Nobody"},
    ]
    images = [_mission_frame((22, 52, 63)), _mission_frame((80, 26, 14)), _mission_frame((70, 26, 14)), _mission_frame((255, 0, 0))]
    overrides = {"mission.std": {"quadrant": {"cx": 0.1, "cy": 0.5, "r": 0.05, "fill": "#000000", "sizePt": 15}}}
    logs = []
    badges = quadrant_badges(frames, lambda i: images[i], overrides, logs.append)
    assert sorted(badges) == [("std", "A"), ("std", "G")]
    disc, fill = badges[("std", "G")]
    assert fill == "#4b1a0e"  # the mean of the two red discs, letter excluded
    assert disc.shape[2] == 4 and disc[disc.shape[0] // 2, disc.shape[1] // 2, 3] == 255
    assert badges[("std", "A")][1] == "#16343f"
    assert logs and "A=1 frames" in logs[0] and "G=2 frames" in logs[0]


def test_corner_fill_is_the_colour_behind_the_emblem():
    frame = _std_frame()
    cx, cy, r = STD_CORNER_DISC[0] * 744, STD_CORNER_DISC[1] * 1039, STD_CORNER_DISC[2] * 744
    yy, xx = np.indices(frame.shape[:2])
    frame[np.hypot(xx - cx, yy - cy) <= r] = (1, 3, 28)  # the dark navy disc the HiRes frames have
    frame[int(cy) - 20 : int(cy) + 20, int(cx) - 20 : int(cx) + 20] = (200, 60, 120)  # the emblem, back on top
    assert corner_fill(frame, "std") == "#01031c"


def test_corner_emblems_take_personnel_before_ship_and_hires_before_std():
    def med(v):
        a = np.zeros((1039, 744, 3), np.uint8)
        a[...] = v
        return a

    medians = {
        ("ship", "std", "vidiian"): med(10),
        ("personnel", "std", "vidiian"): med(20),
        ("personnel", "std", "klingon"): med(30),
        ("personnel", "hires", "klingon"): med(40),
        ("ship", "std", "ferengi"): med(50),
        ("mission", "std", "planet"): med(60),
    }
    out = corner_emblems(medians)
    assert sorted(out) == ["ferengi", "klingon", "vidiian"]
    assert out["vidiian"][0] == "std" and out["vidiian"][1][..., :3].max() == 20
    assert out["klingon"][0] == "hires" and out["klingon"][1][..., :3].max() == 40
    assert out["ferengi"][0] == "std" and out["ferengi"][1][..., :3].max() == 50
    assert out["klingon"][1].shape[2] == 4
