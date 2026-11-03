"""Pure helpers for classifying TrekCC card text lines and deriving layout templates.

A ``Line`` is ``((x0, y0, x1, y1), text, font_name, size_pt)`` with the box expressed as
fractions of the card image rectangle on the PDF page.
"""

from __future__ import annotations

import statistics
from collections import Counter
from typing import Iterable

Box = tuple[float, float, float, float]
# (box, text, font, size) plus an optional 5th element: the text colour as "#rrggbb"
Line = tuple[Box, str, str, float] | tuple[Box, str, str, float, str]

TYPE_WORDS = {"Dilemma": "dilemma", "Event": "event", "Interrupt": "interrupt", "Equipment": "equipment"}
PERSONNEL_ATTRS = ("Integrity", "Cunning", "Strength")
SHIP_ATTRS = ("Range", "Weapons", "Shields")
ATTR_WORDS = PERSONNEL_ATTRS + SHIP_ATTRS

BULLET_GAP = 0.043  # horizontal space reserved for the skill bullet before the skill text
BULLET_SIZE = 0.026


def family_for(w: int, h: int) -> str | None:
    if 1015 <= w <= 1023 and 1462 <= h <= 1466:
        return "hires"
    if w == 744 and h == 1039:
        return "std"
    return None


def is_title_font(font: str) -> bool:
    return "crillee" in font.lower()


def font_role(font: str) -> str:
    if is_title_font(font):
        return "title"
    f = font.lower()
    bold = "bold" in f
    italic = "obl" in f or "italic" in f
    light = "light" in f
    if bold and "sc" in f.split("-")[-1]:
        return "bodyBoldSC"
    if bold and italic:
        return "bodyBoldItalic"
    if bold:
        return "bodyBold"
    if light and italic:
        return "bodyLightItalic"
    if italic:
        return "bodyItalic"
    return "body"


def classify_type(lines: Iterable[Line]) -> str:
    lines = list(lines)
    for box, text, *_rest in lines:
        if text.strip() in TYPE_WORDS and 0.45 <= box[1] <= 0.62:
            return TYPE_WORDS[text.strip()]
    texts = [t.strip().upper() for b, t, *_rest in lines if b[1] > 0.85]
    if any(t.startswith(tuple(a.upper() for a in PERSONNEL_ATTRS)) for t in texts):
        return "personnel"
    if any(t.startswith(tuple(a.upper() for a in SHIP_ATTRS)) for t in texts):
        return "ship"
    return "mission"


def _sorted(lines: Iterable[Line]) -> list[Line]:
    return sorted(lines, key=lambda l: (round(l[0][1], 3), l[0][0]))


def line_roles(ctype: str, lines: Iterable[Line]) -> list[tuple[str, Line]]:
    """Assign a role to every line, preserving reading order."""
    ordered = _sorted(lines)
    roles: list[tuple[str, Line]] = []
    for line in ordered:
        (x0, y0, _x1, _y1), text, font, size = line[:4]
        t = text.strip()
        role = "body"
        if size < 4.5 and (_x1 - x0) < 0.035 and (_y1 - y0) > 0.08:
            role = "legal"  # the vertical "NOT ENDORSED" disclaimer
        elif y0 > 0.93 and size <= 4.5:
            role = "collector"
        elif is_title_font(font):
            if y0 < 0.1 and x0 < 0.24 and t.isdigit():
                role = "cost"
            elif size >= 12:
                role = "points"
            elif y0 > 0.9:
                role = "span"
            elif size >= 7.5 and y0 < 0.1:
                role = "title"
            elif y0 < 0.13:
                role = "subtitle"
            else:
                role = "body"
        elif y0 > 0.85 and (
            font_role(font) == "bodyBoldSC" or t.upper().startswith(tuple(a.upper() for a in ATTR_WORDS))
        ):
            role = "attr"
        elif ctype != "mission" and 0.5 <= y0 <= 0.6 and font_role(font) != "title":
            role = "typeBar"
        roles.append((role, line))

    if ctype == "personnel":
        type_bar_y = next((l[0][3] for r, l in roles if r == "typeBar"), 0.5)
        body_start = next(
            (
                l[0][1]
                for r, l in roles
                if r == "body" and l[0][1] > type_bar_y and (l[0][0] <= 0.15 or l[0][2] - l[0][0] > 0.45)
            ),
            1.0,
        )
        roles = [
            ("skill", l) if r == "body" and type_bar_y <= l[0][1] < body_start - 1e-6 else (r, l)
            for r, l in roles
        ]
    elif ctype == "mission":
        body_start = next(
            (l[0][1] for r, l in roles if r == "body" and l[0][0] < 0.15 and l[0][1] > 0.5), 1.0
        )
        roles = [
            ("requirement", l) if r == "body" and 0.5 < l[0][1] < body_start - 1e-6 else (r, l)
            for r, l in roles
        ]
    return roles


def median_box(boxes: Iterable[Box]) -> list[float]:
    boxes = list(boxes)
    return [round(statistics.median(b[i] for b in boxes), 4) for i in range(4)]


def _most_common(values: Iterable[float], default: float) -> float:
    values = list(values)
    if not values:
        return default
    return Counter(values).most_common(1)[0][0]


ROLE_FONTS = {
    "cost": "title", "title": "title", "subtitle": "title", "points": "title", "span": "title",
    "typeBar": "bodyBold", "collector": "bodyBold",
}


def _box_entry(role: str, lines: list[Line], align: str) -> dict:
    box = median_box(l[0] for l in lines)
    font = ROLE_FONTS.get(role, "bodyBoldSC" if role.startswith("attr") else "body")
    size = _most_common((l[3] for l in lines), 7.0)
    return {"x0": box[0], "y0": box[1], "x1": box[2], "y1": box[3], "font": font, "sizePt": size, "align": align}


CENTERED = {"cost", "points", "span", "typeBar"}


def merge_attr_lines(lines: list[Line], gap: float = 0.1) -> list[Line]:
    """Join attribute label/value pieces that sit on one row within ``gap`` into single boxes."""
    out: list[Line] = []
    for line in sorted(lines, key=lambda l: l[0][0]):
        if out and line[0][0] - out[-1][0][2] < gap:
            (x0, y0, x1, y1), text, font, size = out[-1][:4]
            b = line[0]
            merged = ((x0, min(y0, b[1]), max(x1, b[2]), max(y1, b[3])), f"{text} {line[1]}", font, size)
            out[-1] = merged + tuple(out[-1][4:])  # keep the colour of the first piece
        else:
            out.append(line)
    return out


def line_colour(lines: Iterable[Line]) -> str | None:
    """Most common recorded colour among ``lines`` (None when the lines carry no colour)."""
    counts: dict[str, int] = {}
    for l in lines:
        if len(l) > 4 and isinstance(l[4], str):
            counts[l[4]] = counts.get(l[4], 0) + 1
    return max(counts, key=counts.get) if counts else None


def _with_colour(entry: dict | None, lines: Iterable[Line]) -> dict | None:
    if entry is None:
        return None
    c = line_colour(lines)
    if c:
        entry["colour"] = c
    return entry


def derive_template(ctype: str, family: str, cards: list[list[tuple[str, Line]]], ref_width_pt: float) -> dict:
    by_role: dict[str, list[Line]] = {}
    body_lines: list[Line] = []
    skill_lines: list[Line] = []
    req_lines: list[Line] = []
    per_card_first_body_y: list[float] = []
    per_card_body_x0: list[float] = []
    per_card_body_x1: list[float] = []
    line_gaps: list[float] = []
    body_sizes: list[float] = []
    lore_sizes: list[float] = []
    skill_first_y: list[float] = []
    skill_x0: list[float] = []
    skill_x1: list[float] = []
    skill_gaps: list[float] = []
    req_boxes: list[Box] = []
    req_sizes: list[float] = []
    attr_y0: list[float] = []
    collector_y0: list[float] = []
    last_body_y1: list[float] = []

    for card in cards:
        attrs = merge_attr_lines([l for r, l in card if r == "attr"])
        for i, l in enumerate(attrs[:3]):
            by_role.setdefault(f"attr{i}", []).append(l)
            attr_y0.append(l[0][1])
        for r, l in card:
            if r in ("cost", "title", "subtitle", "typeBar", "points", "span", "collector"):
                by_role.setdefault(r, []).append(l)
            if r == "collector":
                collector_y0.append(l[0][1])
        bodies = [l for r, l in card if r == "body"]
        body_lines.extend(bodies)
        if bodies:
            per_card_first_body_y.append(bodies[0][0][1])
            per_card_body_x0.append(min(l[0][0] for l in bodies))
            per_card_body_x1.append(max(l[0][2] for l in bodies))
            last_body_y1.append(max(l[0][3] for l in bodies))
            ys = sorted({round(l[0][1], 4) for l in bodies})
            line_gaps.extend(b - a for a, b in zip(ys, ys[1:]) if 0.015 < b - a < 0.06)
            for l in bodies:
                if font_role(l[2]) == "bodyLightItalic":
                    lore_sizes.append(l[3])
                else:
                    body_sizes.append(l[3])
        skills = [l for r, l in card if r == "skill"]
        skill_lines.extend(skills)
        if skills:
            skill_first_y.append(skills[0][0][1])
            skill_x0.append(min(l[0][0] for l in skills))
            skill_x1.append(max(l[0][2] for l in skills))
            ys = sorted({round(l[0][1], 4) for l in skills})
            skill_gaps.extend(b - a for a, b in zip(ys, ys[1:]) if 0.015 < b - a < 0.06)
        reqs = [l for r, l in card if r == "requirement"]
        req_lines.extend(reqs)
        if reqs:
            req_boxes.append(
                (
                    min(l[0][0] for l in reqs),
                    min(l[0][1] for l in reqs),
                    max(l[0][2] for l in reqs),
                    max(l[0][3] for l in reqs),
                )
            )
            req_sizes.extend(l[3] for l in reqs)

    boxes = {
        role: _with_colour(_box_entry(role, lines, "center" if role in CENTERED else "left"), lines)
        for role, lines in by_role.items()
    }

    flow_size = _most_common(body_sizes, 7.0)
    line_height = round(statistics.median(line_gaps), 4) if line_gaps else round(flow_size / ref_width_pt * 0.73, 4)
    if attr_y0:
        limit = statistics.median(attr_y0) - 0.01
    elif collector_y0:
        limit = statistics.median(collector_y0) - 0.02
    else:
        limit = 0.95
    if last_body_y1 and not attr_y0:
        limit = min(limit, max(last_body_y1) + line_height)
    flow_y1 = round(limit, 4)
    flow = {
        "x0": round(statistics.median(per_card_body_x0), 4) if per_card_body_x0 else 0.136,
        "y0": round(statistics.median(per_card_first_body_y), 4) if per_card_first_body_y else 0.65,
        "x1": round(statistics.median(per_card_body_x1) + 0.005, 4) if per_card_body_x1 else 0.93,
        "y1": flow_y1,
        "sizePt": flow_size,
        "lineHeight": line_height,
    }
    lore = {"sizePt": _most_common(lore_sizes, round(flow_size - 0.5, 2))}

    skills = None
    if skill_first_y:
        skills = {
            "x0": round(statistics.median(skill_x0) - BULLET_GAP, 4),
            "y0": round(statistics.median(skill_first_y), 4),
            "x1": round(statistics.median(per_card_body_x1) + 0.005, 4) if per_card_body_x1 else 0.93,
            "rowHeight": round(statistics.median(skill_gaps), 4) if skill_gaps else line_height,
            "bulletSize": BULLET_SIZE,
        }

    requirements = None
    if req_boxes:
        rb = median_box(req_boxes)
        requirements = {"x0": rb[0], "y0": rb[1], "x1": rb[2], "y1": rb[3], "sizePt": _most_common(req_sizes, flow_size)}

    return {
        "type": ctype,
        "family": family,
        "refWidthPt": ref_width_pt,
        "artBox": None,
        "boxes": boxes,
        "flow": _with_colour(flow, body_lines),
        "lore": lore,
        "skills": _with_colour(skills, skill_lines),
        "requirements": _with_colour(requirements, req_lines),
    }
