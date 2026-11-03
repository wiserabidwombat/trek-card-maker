import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cardsort import derive_template, line_colour  # noqa: E402


def _line(box, text, colour=None, font="FuturaCondensed", size=7.0):
    return (box, text, font, size, colour) if colour else (box, text, font, size)


def test_line_colour_majority_and_none():
    assert line_colour([_line((0, 0, 1, 1), "a", "#ffffff"), _line((0, 0, 1, 1), "b", "#ffffff"), _line((0, 0, 1, 1), "c", "#231f20")]) == "#ffffff"
    assert line_colour([_line((0, 0, 1, 1), "a")]) is None


def test_derive_template_records_role_colours():
    card = [
        ("title", _line((0.24, 0.02, 0.5, 0.06), "Worf", "#231f20", "Crillee", 8.5)),
        ("cost", _line((0.17, 0.02, 0.2, 0.06), "3", "#ffffff", "Crillee", 8.0)),
        ("attr", _line((0.14, 0.9, 0.32, 0.94), "Integrity 6", "#ffffff", "FuturaCondensed-Bold", 6.8)),
        ("body", _line((0.14, 0.7, 0.9, 0.73), "Game text.", "#231f20")),
        ("skill", _line((0.16, 0.63, 0.4, 0.66), "Honor", "#231f20", "FuturaCondensed-Bold", 7.0)),
    ]
    t = derive_template("personnel", "hires", [card, card], 163.5)
    assert t["boxes"]["cost"]["colour"] == "#ffffff"
    assert t["boxes"]["title"]["colour"] == "#231f20"
    assert t["boxes"]["attr0"]["colour"] == "#ffffff"
    assert t["flow"]["colour"] == "#231f20"
    assert t["skills"]["colour"] == "#231f20"


def test_derive_template_without_colours_has_none():
    card = [("title", _line((0.24, 0.02, 0.5, 0.06), "Worf", None, "Crillee", 8.5)), ("body", _line((0.14, 0.7, 0.9, 0.73), "Text."))]
    t = derive_template("event", "hires", [card], 163.5)
    assert "colour" not in t["boxes"]["title"]
    assert "colour" not in t["flow"]


def test_line_roles_and_attr_merge_accept_coloured_lines():
    from cardsort import line_roles, merge_attr_lines

    lines = [
        _line((0.24, 0.02, 0.5, 0.06), "Worf", "#231f20", "Crillee", 8.5),
        _line((0.14, 0.9, 0.2, 0.94), "Integrity", "#ffffff", "FuturaCondensed-BoldSC", 6.8),
        _line((0.21, 0.9, 0.3, 0.94), "6", "#ffffff", "FuturaCondensed-BoldSC", 6.8),
    ]
    roles = line_roles("personnel", lines)
    assert [r for r, _ in roles].count("attr") == 2
    merged = merge_attr_lines([l for r, l in roles if r == "attr"])
    assert merged[0][1] == "Integrity 6"
    assert merged[0][4] == "#ffffff"
