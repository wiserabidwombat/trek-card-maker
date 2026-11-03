"""Pass 3 of the extractor: variants, slot geometry, base frames, rings and full-size icon crops.

Input: the per-card frames written by pass 1 (with affiliation/cluster from pass 2), the
templates, and the art boxes. Output: ``base/<type>.<variant>.jpg`` (+ thumbs), ``rings/``,
``icons/big-*.png`` and ``icons/mission-*.png``, plus the catalog entries for all of them.
"""

from __future__ import annotations

import os
import re
from collections import Counter, defaultdict

import numpy as np
from PIL import Image, ImageDraw

from baseframe import clean_strip, fill_art_box, median_frame, patch_slot, socket_present
from iconcrop import crop_box_rgba, crop_disc, crop_ring, merge_boxes, sharpness, strip_blobs, tight_crop
from refs import nearest_reference
from slots import detect_slots, measure_strip, refine_slot, regularize_slots
from variants import dilemma_variant, mission_variant, pick_family

COLUMN = {"hires": (0.0, 0.56, 0.14, 0.88), "std": (0.0, 0.56, 0.18, 0.86)}
MISSION_BAND = (0.10, 0.855, 0.90, 0.935)
MAX_GROUP = 40
MAX_SLOTS = 4
RING_INNER = 0.72
OTHER_ICONS = [
    "command",
    "staff",
    "past",
    "alternate",
    "future",
    "deep-space-nine",
    "earth",
    "maquis",
    "terok-nor",
    "next-generation",
    "original-series",
    "voyager",
]
AFFILIATION_ICONS = ["bajoran", "borg", "cardassian", "dominion", "federation", "ferengi", "klingon", "romulan", "starfleet", "non-aligned"]
SOCKET_MATCH_MAX = 70.0
STRIP_MATCH_MAX = 90.0
MIN_SKILL_COUNT = 5
LABELS = {"non-aligned": "Non-Aligned", "deep-space-nine": "Deep Space Nine"}


def label_for(variant: str) -> str:
    return LABELS.get(variant, variant.replace("-", " ").title())


def _thumb(img: Image.Image, path: str) -> None:
    th = img.copy()
    th.thumbnail((400, 240))
    th.save(path, quality=85)


def _sheet(items: list[tuple[np.ndarray, str]], path: str, cell: int = 96, cols: int = 12) -> None:
    if not items:
        return
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", ((cell + 8) * cols, (cell + 24) * rows), "white")
    d = ImageDraw.Draw(sheet)
    for i, (arr, lab) in enumerate(items):
        im = Image.fromarray(arr, "RGBA")
        im.thumbnail((cell, cell))
        x, y = (cell + 8) * (i % cols), (cell + 24) * (i // cols)
        sheet.paste(im, (x + 4, y + 2), im)
        d.text((x + 2, y + cell + 6), lab[:20], fill="black")
    sheet.save(path)


def collect_skills(roles_by_frame: list[list]) -> list[str]:
    counts: Counter[str] = Counter()
    for roles in roles_by_frame:
        for role, line in roles:
            if role != "skill":
                continue
            for part in re.split(r"\s{2,}|\t|•", line[1]):
                part = part.strip(" .").replace("ﬁ", "fi").replace("ﬂ", "fl")
                if not part:
                    continue
                m = re.match(r"^(\d+)\s+(.*)$", part)
                name = m.group(2) if m else part
                if re.fullmatch(r"[A-Z][a-z]+", name):
                    counts[name] += 1
    return sorted(n for n, c in counts.items() if c >= MIN_SKILL_COUNT)


def build_base_catalog(
    frames: list[dict],
    roles_by_frame: list[list],
    templates: dict[str, dict],
    art_box_px: dict[str, tuple[int, int, int, int]],
    out: str,
    refs: dict[str, np.ndarray],
    review: bool,
    log,
) -> dict:
    for sub in ("base", os.path.join("base", "thumbs"), "rings", "icons"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    cache: dict[int, np.ndarray] = {}

    def load(i: int) -> np.ndarray:
        if i not in cache:
            cache[i] = np.asarray(Image.open(os.path.join(out, frames[i]["file"])).convert("RGB")).copy()
        return cache[i]

    def free(idxs: list[int]) -> None:
        for i in idxs:
            cache.pop(i, None)

    # ---- variants ----
    for i, fr in enumerate(frames):
        if fr["type"] in ("personnel", "ship"):
            fr["variant"] = fr["affiliation"]
        elif fr["type"] == "mission":
            fr["variant"] = mission_variant(load(i))
        elif fr["type"] == "dilemma":
            fr["variant"] = dilemma_variant(load(i))
        else:
            fr["variant"] = "default"
    cache.clear()

    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, fr in enumerate(frames):
        groups[(fr["type"], fr["variant"])].append(i)

    def same_shape(idxs: list[int]) -> list[int]:
        """Keep the frames of the most common pixel size (some sets are 1021 px wide, not 1022)."""
        if not idxs:
            return idxs
        shape = Counter((frames[i]["w"], frames[i]["h"]) for i in idxs).most_common(1)[0][0]
        return [i for i in idxs if (frames[i]["w"], frames[i]["h"]) == shape]

    def members_of(key: tuple[str, str]) -> tuple[str, list[int]]:
        idxs = groups[key]
        fam = pick_family([frames[i] for i in idxs])
        fam_idxs = [i for i in idxs if frames[i]["family"] == fam]
        if key[0] in ("personnel", "ship"):
            by_cluster: Counter[str] = Counter(frames[i].get("cluster", "") for i in fam_idxs)
            top = by_cluster.most_common(1)[0][0]
            fam_idxs = [i for i in fam_idxs if frames[i].get("cluster", "") == top]
        return fam, same_shape(fam_idxs)[:MAX_GROUP]

    # ---- slots per family (from the largest personnel group) ----
    slots_by_family: dict[str, list[dict]] = {}
    for fam in ("hires", "std"):
        cands = [(k, members_of(k)) for k in groups if k[0] == "personnel"]
        cands = [(k, m) for k, (f, m) in cands if f == fam and len(m) >= 3]
        if not cands:
            continue
        key, idxs = max(cands, key=lambda km: len(km[1]))
        arrs = [load(i) for i in idxs]
        med = median_frame(arrs)
        raw = detect_slots(arrs, column=COLUMN[fam])[:MAX_SLOTS]
        if raw:
            size = max(s["size"] for s in raw)
            cx = float(np.median([s["cx"] for s in raw]))
            refined = [refine_slot(med, {"cx": cx, "cy": s["cy"], "size": size}) for s in raw]
            slots_by_family[fam] = regularize_slots(refined, MAX_SLOTS)
            log(f"slots {fam} from {key[1]} ({len(idxs)} frames): raw={raw} -> {slots_by_family[fam]}")
        free(idxs)
    for fam, slots in slots_by_family.items():
        if f"personnel.{fam}" in templates:
            templates[f"personnel.{fam}"]["iconSlots"] = slots
        if f"ship.{fam}" in templates:
            templates[f"ship.{fam}"]["iconSlots"] = slots[1:] if len(slots) > 1 else slots

    # ---- mission strip geometry ----
    mission_sets: dict[str, list[int]] = defaultdict(list)
    for i, fr in enumerate(frames):
        if fr["type"] == "mission":
            mission_sets[fr["family"]].append(i)
    strip_blob_sets: dict[int, list] = {}
    for fam in list(mission_sets):
        mission_sets[fam] = same_shape(mission_sets[fam])
        idxs = mission_sets[fam]
        W, H = frames[idxs[0]]["w"], frames[idxs[0]]["h"]
        band = (int(MISSION_BAND[0] * W), int(MISSION_BAND[1] * H), int(MISSION_BAND[2] * W), int(MISSION_BAND[3] * H))
        sets = []
        for i in idxs:
            boxes = merge_boxes(strip_blobs(load(i), band))
            strip_blob_sets[i] = boxes
            sets.append(boxes)
        m = measure_strip(sets, W, H)
        if m and f"mission.{fam}" in templates:
            templates[f"mission.{fam}"]["missionAffiliations"] = m
            log(f"mission strip {fam}: {m}")

    # ---- base frames ----
    base_frames: list[dict] = []
    group_medians: dict[tuple[str, str, str], np.ndarray] = {}  # (type, fam, variant) -> median
    rings: dict[tuple[str, str], str] = {}
    review_dir = os.path.join(out, "review")
    for key in sorted(groups):
        ctype, variant = key
        fam, idxs = members_of(key)
        if not idxs:
            continue
        arrs = [load(i) for i in idxs]
        W, H = arrs[0].shape[1], arrs[0].shape[0]
        med = median_frame(arrs)
        group_medians[(ctype, fam, variant)] = med
        free(idxs)
    for key in sorted(groups):
        ctype, variant = key
        fam, idxs = members_of(key)
        if not idxs:
            continue
        med = group_medians[(ctype, fam, variant)]
        H, W = med.shape[:2]
        base = med.copy()
        tf = f"{ctype}.{fam}"
        if tf in art_box_px:
            fill_art_box(base, art_box_px[tf])
        notes = []
        slots = slots_by_family.get(fam, []) if ctype in ("personnel", "ship") else []
        if slots:
            step_px = int(round((slots[1]["cy"] - slots[0]["cy"]) * H)) if len(slots) > 1 else int(0.07 * H)
            donor = group_medians.get(("ship", fam, variant)) if ctype == "personnel" else group_medians.get(("personnel", fam, variant))
            for s in slots:
                if socket_present(base, s, W, H):
                    use = donor if donor is not None and not socket_present(donor, s, W, H) else None
                    notes.append(f"slot@{s['cy']}:{patch_slot(base, s, W, H, use, step_px)}")
        if ctype == "mission":
            fam_missions = [i for i in mission_sets[fam]][:MAX_GROUP]
            band = (0, int(0.85 * H), W, int(0.94 * H))
            clean_strip(base, band, [load(i) for i in fam_missions])
            free(fam_missions)
        fid = f"{ctype}.{variant}"
        img = Image.fromarray(base, "RGB")
        img.save(os.path.join(out, "base", f"{fid}.jpg"), quality=92, subsampling=0)
        _thumb(img, os.path.join(out, "base", "thumbs", f"{fid}.jpg"))
        # ring for personnel/ship groups, from the median's first occupied socket
        ring_file = None
        if ctype in ("personnel", "ship") and slots:
            rkey = (fam, variant)
            if rkey not in rings:
                for s in slots:
                    if socket_present(med, s, W, H):
                        r_outer = s["size"] * W / 2
                        ring = crop_ring(med, s["cx"] * W, s["cy"] * H, r_outer, RING_INNER * r_outer)
                        rings[rkey] = f"rings/{fam}.{variant}.png"
                        Image.fromarray(ring, "RGBA").save(os.path.join(out, rings[rkey]))
                        break
            ring_file = rings.get(rkey)
        src = frames[idxs[0]]
        base_frames.append(
            {
                "id": fid,
                "set": "base",
                "type": ctype,
                "family": fam,
                "affiliation": variant if ctype in ("personnel", "ship") else "none",
                "variant": variant,
                "label": label_for(variant),
                "sourceTitle": "",
                "w": W,
                "h": H,
                "file": f"base/{fid}.jpg",
                "thumb": f"base/thumbs/{fid}.jpg",
                "overlay": src.get("overlay"),
                "ring": ring_file,
                "artBox": None,
            }
        )
        log(f"base {fid}: {fam} from {len(idxs)} frames" + (f" ({', '.join(notes)})" if notes else ""))
        if review:
            pair = Image.new("RGB", (W, H // 2))
            pair.paste(Image.fromarray(med[H // 2 :], "RGB").crop((0, 0, W // 2, H // 2)), (0, 0))
            pair.paste(Image.fromarray(base[H // 2 :], "RGB").crop((0, 0, W // 2, H // 2)), (W // 2, 0))
            d = ImageDraw.Draw(pair)
            for s in slots:
                r = s["size"] * W / 2
                cx, cy = W // 2 + s["cx"] * W, s["cy"] * H - H // 2
                d.ellipse((cx - r, cy - r, cx + r, cy + r), outline="lime", width=2)
            pair.thumbnail((900, 700))
            pair.save(os.path.join(review_dir, f"base_{fid}.png"))

    # ---- socket icons (hires frames of every affiliation) ----
    extra_icons: list[dict] = []
    other_refs = {k: v for k, v in refs.items() if k in OTHER_ICONS}
    best: dict[str, tuple[float, np.ndarray]] = {}
    matched_review: list[tuple[np.ndarray, str]] = []
    unmatched_review: list[tuple[np.ndarray, str]] = []
    if other_refs:
        fam = "hires" if "hires" in slots_by_family else "std"
        slots = slots_by_family.get(fam, [])
        for i, fr in enumerate(frames):
            if fr["type"] not in ("personnel", "ship") or fr["family"] != fam:
                continue
            arr = load(i)
            H, W = arr.shape[:2]
            for si, s in enumerate(slots):
                if not socket_present(arr, s, W, H):
                    continue
                r = s["size"] * W / 2 * RING_INNER
                crop = crop_disc(arr, s["cx"] * W, s["cy"] * H, r)
                name, dist = nearest_reference(crop, other_refs)
                lab = f"{name} {dist:.0f} {fr['id'][-7:]}/{si}"
                if dist <= SOCKET_MATCH_MAX:
                    sh = sharpness(crop)
                    if name not in best or sh > best[name][0]:
                        best[name] = (sh, crop)
                    matched_review.append((crop, lab))
                else:
                    unmatched_review.append((crop, lab))
            free([i])
        for name, (_sh, crop) in sorted(best.items()):
            file = f"icons/big-{name}.png"
            Image.fromarray(crop, "RGBA").save(os.path.join(out, file))
            extra_icons.append({"id": f"big-{name}", "file": file, "w": crop.shape[1], "h": crop.shape[0], "group": "other"})
        missing = sorted(set(OTHER_ICONS) - set(best))
        log(f"socket icons: {sorted(best)}; missing {missing}; unmatched crops {len(unmatched_review)}")
        if review:
            matched_review.sort(key=lambda t: t[1])
            _sheet(matched_review[:240], os.path.join(review_dir, "icons_sockets.png"))
            _sheet(unmatched_review[:120], os.path.join(review_dir, "icons_unmatched.png"))

    # ---- mission affiliation icons ----
    aff_refs = {k: tight_crop(v, inner=0.34) for k, v in refs.items() if k in AFFILIATION_ICONS}
    best_m: dict[str, tuple[float, np.ndarray]] = {}
    mission_review: list[tuple[np.ndarray, str]] = []
    if aff_refs and "hires" in mission_sets:
        for i in mission_sets["hires"]:
            arr = load(i)
            for box in strip_blob_sets.get(i, []):
                crop = tight_crop(crop_box_rgba(arr, box))
                if crop.shape[0] < 20 or crop.shape[1] < 20:
                    continue
                name, dist = nearest_reference(crop, aff_refs)
                lab = f"{name} {dist:.0f} {frames[i]['id'][-7:]}"
                mission_review.append((crop, lab))
                if dist <= STRIP_MATCH_MAX:
                    sh = sharpness(crop)
                    if name not in best_m or sh > best_m[name][0]:
                        best_m[name] = (sh, crop)
            free([i])
        for name, (_sh, crop) in sorted(best_m.items()):
            file = f"icons/mission-{name}.png"
            Image.fromarray(crop, "RGBA").save(os.path.join(out, file))
            extra_icons.append({"id": f"mission-{name}", "file": file, "w": crop.shape[1], "h": crop.shape[0], "group": "missionAffiliation"})
        log(f"mission icons: {sorted(best_m)}; missing {sorted(set(AFFILIATION_ICONS) - set(best_m))}")
        if review:
            mission_review.sort(key=lambda t: t[1])
            _sheet(mission_review[:240], os.path.join(review_dir, "icons_mission.png"))

    skills = collect_skills(roles_by_frame)
    log(f"skills ({len(skills)}): {skills}")
    return {"frames": base_frames, "icons": extra_icons, "skills": skills}
