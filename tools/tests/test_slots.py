import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from slots import detect_slots, detect_strip  # noqa: E402

H, W = 300, 200


def _blank():
    a = np.zeros((H, W, 3), np.uint8)
    a[...] = (80, 90, 100)
    return a


def _disc(a, cx, cy, r, colour=(230, 230, 230)):
    yy, xx = np.mgrid[:H, :W]
    a[(xx - cx) ** 2 + (yy - cy) ** 2 <= r * r] = colour


def test_detect_slots_finds_two_sockets():
    frames = []
    for i in range(6):
        a = _blank()
        if i < 3:
            _disc(a, 20, 170, 15)
        if 3 <= i < 5:
            _disc(a, 20, 210, 15)
        frames.append(a)
    slots = detect_slots(frames, column=(0.0, 0.5, 0.25, 0.95), min_height=0.02)
    assert len(slots) == 2
    assert abs(slots[0]["cy"] - 170 / H) < 0.01
    assert abs(slots[1]["cy"] - 210 / H) < 0.01
    assert abs(slots[0]["cx"] - 20 / W) < 0.02
    assert abs(slots[0]["size"] - 30 / W) < 0.02


def test_detect_strip_measures_step_and_size():
    frames = []
    for i in range(6):
        a = _blank()
        if i % 2 == 0:
            _disc(a, 100, 270, 10)
        if i % 3 == 0:
            _disc(a, 130, 270, 10)
            _disc(a, 70, 270, 10)
        frames.append(a)
    strip = detect_strip(frames, band=(0.0, 0.85, 1.0, 0.95))
    assert strip is not None
    assert abs(strip["cy"] - 270 / H) < 0.01
    assert abs(strip["step"] - 30 / W) < 0.01
    assert abs(strip["size"] - 20 / W) < 0.02


def test_refine_slot_recentres_on_ring():
    from slots import refine_slot

    a = _blank()
    yy, xx = np.mgrid[:H, :W]
    d = np.sqrt((xx - 32) ** 2 + (yy - 155) ** 2)
    a[(d <= 16) & (d >= 13)] = (210, 210, 210)
    slot = {"cx": 30 / W, "cy": 150 / H, "size": 36 / W}
    out = refine_slot(a, slot)
    assert abs(out["cx"] * W - 32) < 1.5
    assert abs(out["cy"] * H - 155) < 1.5
    assert abs(out["size"] * W - 32) < 3


def test_measure_strip():
    from slots import measure_strip

    sets = [[(100, 260, 120, 280), (150, 260, 170, 280)], [(125, 261, 145, 279)]]
    m = measure_strip(sets, W, H)
    assert m is not None
    assert abs(m["step"] - 50 / W) < 1e-6
    assert abs(m["cy"] - 270 / H) < 1e-6
    assert abs(m["size"] - 20 / W) < 0.01


def test_regularize_slots_fills_gaps():
    from slots import regularize_slots

    slots = [{"cx": 0.07, "cy": 0.64, "size": 0.08}, {"cx": 0.07, "cy": 0.78, "size": 0.08}, {"cx": 0.07, "cy": 0.71, "size": 0.08}]
    out = regularize_slots([slots[0], slots[1]] + [{"cx": 0.07, "cy": 0.85, "size": 0.08}])
    assert [round(s["cy"], 2) for s in out] == [0.64, 0.71, 0.78, 0.85]
    assert len(regularize_slots([slots[0]])) == 1
