import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from cardsort import (  # noqa: E402
    classify_type,
    derive_template,
    family_for,
    line_roles,
    median_box,
    merge_attr_lines,
)

CRIL = "Crillee"
FB = "Futura-CondensedBold"
F = "Futura-Condensed"
FL = "Futura-CondensedLightObl"
SC = "Futura-CondensedBold-SC7"


def L(x0, y0, x1, y1, t, font=F, size=7.0):
    return ((x0, y0, x1, y1), t, font, size)


def test_family():
    assert family_for(1022, 1464) == "hires"
    assert family_for(1021, 1465) == "hires"
    assert family_for(744, 1039) == "std"
    assert family_for(2550, 3300) is None


def test_classify_type_by_typebar_word():
    assert classify_type([L(0.41, 0.53, 0.57, 0.57, "Dilemma", FB, 8)]) == "dilemma"
    assert classify_type([L(0.41, 0.53, 0.57, 0.57, "Interrupt", FB, 8)]) == "interrupt"


def test_classify_personnel_ship_mission():
    assert classify_type([L(0.14, 0.91, 0.32, 0.94, "Integrity 3", SC, 6.8)]) == "personnel"
    assert classify_type([L(0.14, 0.91, 0.24, 0.94, "Range", SC, 6.8)]) == "ship"
    assert (
        classify_type(
            [L(0.89, 0.54, 0.98, 0.61, "35", CRIL, 14.5), L(0.48, 0.94, 0.51, 0.99, "3", CRIL, 10)]
        )
        == "mission"
    )


def test_line_roles_dilemma():
    lines = [
        L(0.171, 0.023, 0.197, 0.065, "2", CRIL, 8),
        L(0.241, 0.038, 0.575, 0.079, "Cutting Remark", CRIL, 7.8),
        L(0.418, 0.532, 0.569, 0.575, "Dilemma", FB, 8),
        L(0.136, 0.656, 0.927, 0.694, "Randomly select", F, 7),
        L(0.957, 0.703, 0.981, 0.871, "NOT ENDORSED", F, 3.3),
        L(0.153, 0.759, 0.59, 0.793, '"quote"', FL, 6.5),
        L(0.874, 0.976, 0.936, 0.998, "49 V 1", FB, 4),
    ]
    rl = line_roles("dilemma", lines)
    roles = {r: l[1] for r, l in rl}
    assert roles["cost"] == "2"
    assert roles["title"] == "Cutting Remark"
    assert roles["typeBar"] == "Dilemma"
    assert roles["collector"] == "49 V 1"
    assert roles["legal"] == "NOT ENDORSED"
    bodies = [l[1] for r, l in rl if r == "body"]
    assert bodies == ["Randomly select", '"quote"']


def test_line_roles_interrupt_without_cost():
    lines = [
        L(0.197, 0.038, 0.67, 0.079, "Calculated Concession", CRIL, 7.8),
        L(0.415, 0.532, 0.572, 0.575, "Interrupt", FB, 8),
        L(0.136, 0.656, 0.925, 0.694, "Order", FB, 7),
    ]
    roles = {r: l[1] for r, l in line_roles("interrupt", lines)}
    assert roles["title"] == "Calculated Concession"
    assert "cost" not in roles


def test_line_roles_personnel_skills_vs_body():
    lines = [
        L(0.24, 0.02, 0.55, 0.064, "•Winn Adami", CRIL, 8.5),
        L(0.171, 0.025, 0.197, 0.066, "3", CRIL, 8),
        L(0.24, 0.061, 0.58, 0.094, "Uneasy Shepherd", CRIL, 6.5),
        L(0.427, 0.529, 0.56, 0.573, "Bajoran", FB, 8),
        L(0.187, 0.627, 0.386, 0.665, "Archaeology", FB, 7),
        L(0.43, 0.627, 0.597, 0.665, "Diplomacy", FB, 7),
        L(0.187, 0.659, 0.362, 0.697, "Leadership", FB, 7),
        L(0.144, 0.70, 0.905, 0.738, "Kai. When you play", FB, 7),
        L(0.144, 0.733, 0.909, 0.769, "cards in your discard", F, 7),
        L(0.142, 0.907, 0.32, 0.944, "Integrity 3", SC, 6.8),
        L(0.45, 0.907, 0.632, 0.944, "Cunning 6", SC, 6.8),
        L(0.763, 0.907, 0.934, 0.944, "Strength 4", SC, 6.8),
    ]
    rl = line_roles("personnel", lines)
    assert [l[1] for r, l in rl if r == "skill"] == ["Archaeology", "Diplomacy", "Leadership"]
    assert [l[1] for r, l in rl if r == "body"][0] == "Kai. When you play"
    assert [l[1] for r, l in rl if r == "attr"] == ["Integrity 3", "Cunning 6", "Strength 4"]
    roles = {r: l[1] for r, l in rl}
    assert roles["subtitle"] == "Uneasy Shepherd"
    assert roles["title"] == "•Winn Adami"
    assert roles["cost"] == "3"


def test_line_roles_mission():
    lines = [
        L(0.197, 0.021, 0.513, 0.061, "•Gorlan Sector", CRIL, 7.8),
        L(0.197, 0.06, 0.577, 0.095, "Crush", CRIL, 6.5),
        L(0.891, 0.539, 0.985, 0.614, "35", CRIL, 14.5),
        L(0.179, 0.595, 0.829, 0.633, "Leadership, Navigation", FB, 7),
        L(0.265, 0.627, 0.733, 0.665, "2 Treachery, and Strength>36", FB, 7),
        L(0.066, 0.671, 0.895, 0.709, "Mirror. When", FB, 7),
        L(0.066, 0.703, 0.84, 0.74, "destroy your", F, 7),
        L(0.481, 0.938, 0.513, 0.99, "3", CRIL, 10),
    ]
    rl = {}
    for r, l in line_roles("mission", lines):
        rl.setdefault(r, []).append(l[1])
    assert rl["points"] == ["35"]
    assert rl["span"] == ["3"]
    assert rl["requirement"] == ["Leadership, Navigation", "2 Treachery, and Strength>36"]
    assert rl["body"] == ["Mirror. When", "destroy your"]


def test_median_box():
    assert median_box([(0, 0, 1, 1), (0.2, 0.2, 0.8, 0.8), (0.1, 0.1, 0.9, 0.9)]) == [0.1, 0.1, 0.9, 0.9]


def test_derive_template_dilemma():
    card = [
        ("cost", L(0.171, 0.023, 0.197, 0.065, "2", CRIL, 8)),
        ("title", L(0.241, 0.038, 0.575, 0.079, "T", CRIL, 7.8)),
        ("typeBar", L(0.418, 0.532, 0.569, 0.575, "Dilemma", FB, 8)),
        ("body", L(0.136, 0.656, 0.927, 0.694, "a", F, 7)),
        ("body", L(0.136, 0.688, 0.909, 0.726, "b", F, 7)),
        ("body", L(0.153, 0.759, 0.59, 0.793, "c", FL, 6.5)),
        ("collector", L(0.874, 0.976, 0.936, 0.998, "49 V 1", FB, 4)),
    ]
    t = derive_template("dilemma", "hires", [card, card], 163.5)
    assert t["refWidthPt"] == 163.5
    assert t["boxes"]["title"]["sizePt"] == 7.8
    assert t["boxes"]["title"]["font"] == "title"
    assert t["boxes"]["cost"]["align"] == "center"
    assert abs(t["flow"]["y0"] - 0.656) < 1e-6
    assert abs(t["flow"]["lineHeight"] - 0.032) < 1e-6
    assert t["flow"]["x0"] == 0.136
    assert abs(t["flow"]["x1"] - 0.932) < 1e-6  # widest body line + a little slack
    assert abs(t["flow"]["y1"] - (0.793 + 0.032)) < 1e-6  # last body line + one line, under collector-0.02
    assert t["flow"]["sizePt"] == 7
    assert t["lore"]["sizePt"] == 6.5
    assert t["skills"] is None
    assert t["requirements"] is None


def test_derive_template_personnel_has_skills_and_attrs():
    card = [
        ("title", L(0.24, 0.02, 0.55, 0.064, "T", CRIL, 8.5)),
        ("cost", L(0.171, 0.025, 0.197, 0.066, "3", CRIL, 8)),
        ("subtitle", L(0.24, 0.061, 0.58, 0.094, "S", CRIL, 6.5)),
        ("typeBar", L(0.427, 0.529, 0.56, 0.573, "Bajoran", FB, 8)),
        ("skill", L(0.187, 0.627, 0.386, 0.665, "Archaeology", FB, 7)),
        ("skill", L(0.187, 0.659, 0.362, 0.697, "Leadership", FB, 7)),
        ("body", L(0.144, 0.70, 0.905, 0.738, "Kai.", FB, 7)),
        ("body", L(0.144, 0.733, 0.909, 0.769, "cards", F, 7)),
        ("attr", L(0.142, 0.907, 0.32, 0.944, "Integrity 3", SC, 6.8)),
        ("attr", L(0.45, 0.907, 0.632, 0.944, "Cunning 6", SC, 6.8)),
        ("attr", L(0.763, 0.907, 0.934, 0.944, "Strength 4", SC, 6.8)),
    ]
    t = derive_template("personnel", "hires", [card], 163.5)
    assert abs(t["skills"]["y0"] - 0.627) < 1e-6
    assert abs(t["skills"]["rowHeight"] - 0.032) < 1e-6
    assert t["skills"]["x0"] < 0.187
    assert t["boxes"]["attr0"]["x0"] == 0.142
    assert t["boxes"]["attr2"]["x0"] == 0.763
    assert t["boxes"]["attr0"]["font"] == "bodyBoldSC"
    assert abs(t["flow"]["y1"] - (0.907 - 0.01)) < 1e-6


def test_std_family_uppercase_attrs_and_title_position():
    lines = [
        L(0.2595, 0.0523, 0.411, 0.0864, "•Seska", "CrilleeTee", 8.5),
        L(0.2049, 0.0593, 0.2189, 0.0924, "1", "CrilleeTee", 8.2),
        L(0.2889, 0.0911, 0.6483, 0.1171, "Complicated Loyalties", "CrilleeTee", 6.5),
        L(0.4138, 0.5349, 0.5862, 0.5688, "Cardassian", "Futura_LT_Condensed", 8.0),
        L(0.2135, 0.6251, 0.3322, 0.6547, "Engineer", "Futura_LT_Condensed", 7.0),
        L(0.1706, 0.6952, 0.8805, 0.7233, "When this personnel", "Futura_LT_Condensed", 7.0),
        L(0.1706, 0.8866, 0.3248, 0.9168, "INTEGRITY 2", "Futura_LT_Condensed", 7.0),
        L(0.4532, 0.8866, 0.609, 0.9168, "CUNNING 7", "Futura_LT_Condensed", 7.0),
        L(0.8349, 0.9499, 0.9036, 0.9653, "56 V 31", "Futura_LT_Condensed", 3.7),
    ]
    assert classify_type(lines) == "personnel"
    rl = line_roles("personnel", lines)
    roles = {r: l[1] for r, l in rl}
    assert roles["title"] == "•Seska" and roles["cost"] == "1" and roles["subtitle"] == "Complicated Loyalties"
    assert [l[1] for r, l in rl if r == "attr"] == ["INTEGRITY 2", "CUNNING 7"]
    assert [l[1] for r, l in rl if r == "skill"] == ["Engineer"]
    assert roles["collector"] == "56 V 31"


def test_mission_requirement_line_not_mistaken_for_attribute():
    lines = [
        L(0.2222, 0.0539, 0.5379, 0.086, "•Argaya System", "CrilleeTee", 8.0),
        L(0.8503, 0.5472, 0.9434, 0.6054, "30", "CrilleeTee", 14.5),
        L(0.2393, 0.5944, 0.7448, 0.624, "Cunning>36, and", "Futura_LT_Condensed", 7.0),
        L(0.1111, 0.67, 0.8273, 0.698, "When you complete", "Futura_LT_Condensed", 7.0),
        L(0.4837, 0.9185, 0.5131, 0.9586, "3", "CrilleeTee", 10.0),
    ]
    assert classify_type(lines) == "mission"
    rl = {}
    for r, l in line_roles("mission", lines):
        rl.setdefault(r, []).append(l[1])
    assert rl["requirement"] == ["Cunning>36, and"]
    assert rl["body"] == ["When you complete"]


def test_std_vertical_legal_line_is_not_body():
    lines = [
        L(0.9306, 0.6943, 0.9479, 0.8523, "NOT ENDORSED BY CBS OR PAR. PIC.", "Futura_LT_Condensed", 3.1),
        L(0.1706, 0.6952, 0.8805, 0.7233, "When this", "Futura_LT_Condensed", 7.0),
    ]
    roles = {r: l[1] for r, l in line_roles("event", lines)}
    assert roles["legal"].startswith("NOT ENDORSED")
    assert roles["body"] == "When this"


def test_ship_attribute_pieces_merge_into_three_boxes():
    attrs = [
        L(0.142, 0.907, 0.238, 0.944, "Range", SC, 6.8),
        L(0.289, 0.907, 0.32, 0.944, "8", SC, 6.8),
        L(0.45, 0.907, 0.632, 0.944, "Weapons 8", SC, 6.8),
        L(0.763, 0.907, 0.87, 0.944, "Shields", SC, 6.8),
        L(0.914, 0.907, 0.934, 0.944, "8", SC, 6.8),
    ]
    merged = merge_attr_lines(attrs)
    assert [m[1] for m in merged] == ["Range 8", "Weapons 8", "Shields 8"]
    assert merged[0][0] == (0.142, 0.907, 0.32, 0.944)
    assert merged[2][0] == (0.763, 0.907, 0.934, 0.944)
    card = [("attr", a) for a in attrs] + [("body", L(0.144, 0.626, 0.856, 0.662, "x", F, 7))]
    t = derive_template("ship", "hires", [card], 163.5)
    assert t["boxes"]["attr1"]["x0"] == 0.45
    assert t["boxes"]["attr2"]["x1"] == 0.934
