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

from baseframe import clean_strip, fill_art_box, median_frame, patch_slot, slot_diff, socket_bands, socket_present
from iconcrop import crop_box_rgba, crop_disc, crop_ring, merge_boxes, sharpness, strip_blobs, tight_crop
from refs import nearest_reference
from slots import detect_slots, measure_strip, refine_slot, regularize_slots
from variants import dilemma_variant, mission_variant, pick_family

COLUMN = {"hires": (0.0, 0.56, 0.14, 0.88), "std": (0.0, 0.56, 0.18, 0.86)}
MISSION_BAND = (0.10, 0.855, 0.90, 0.935)
# the emblem inside the top-left affiliation disc of a HiRes personnel frame (inside its ring)
CORNER_EMBLEM = (0.03, 0.0, 0.11, 0.102)
# the dark disc behind that emblem (centre, radius as fractions of width), just inside the bracket arcs
CORNER_DISC = (0.0735, 0.0546, 0.0627)
# the same for standard-resolution personnel frames, where the emblem sits on plain black with no disc or ring
# (measured on the Vidiian frame: the diamond is centred at 10.35% of the width, 8.1% of the height)
STD_CORNER_DISC = (0.1035, 0.081, 0.062)
HI_SIZE = 96  # px, composed high-resolution inline icon (ring + disc)
HI_DISC = 0.8  # disc diameter as a fraction of the ring diameter
MAX_GROUP = 40
MAX_SLOTS = 4
RING_INNER = 0.66  # icon disc / ring boundary as a fraction of the ring radius (mirrored in src/render/iconLayout.ts)
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
AFFILIATION_ICONS = ["bajoran", "borg", "cardassian", "dominion", "federation", "ferengi", "klingon", "romulan", "starfleet", "non-aligned", "vidiian"]
SOCKET_MATCH_MAX = 160.0  # names were all correct up to ~150 on the calibration sheet; the socket test is the guard
STRIP_MATCH_MAX = 130.0
REF_INNER = 0.33  # the icon disc inside a rulebook reference icon (its ring sits at ~0.42); matches RING_INNER crops
MIN_SKILL_COUNT = 5
LABELS = {"non-aligned": "Non-Aligned", "deep-space-nine": "Deep Space Nine"}


def label_for(variant: str) -> str:
    return LABELS.get(variant, variant.replace("-", " ").title())


def corner_disc(med: np.ndarray, fam: str) -> np.ndarray:
    """RGBA disc behind the top-left affiliation emblem of a personnel median frame (emblem on dark)."""
    h, w = med.shape[:2]
    cx, cy, r = CORNER_DISC if fam == "hires" else STD_CORNER_DISC
    disc = crop_disc(med, cx * w, cy * h, r * w)
    disc[disc[..., 3] < 128, :3] = 0  # nothing outside the disc may leak back in when alpha is recomputed
    return disc


def personnel_median(group_medians: dict[tuple[str, str, str], np.ndarray], name: str) -> tuple[str | None, np.ndarray | None]:
    """The HiRes personnel median for an affiliation, else the standard one (Vidiian has no HiRes set)."""
    for fam in ("hires", "std"):
        med = group_medians.get(("personnel", fam, name))
        if med is not None:
            return fam, med
    return None, None


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


def cleanest_ring(ring_dir: str) -> str | None:
    """The HiRes ring whose opaque pixels are least colourful: a plain silver ring with no sliver
    of a coloured frame border caught in the crop."""
    best: tuple[float, str] | None = None
    if not os.path.isdir(ring_dir):
        return None
    for name in sorted(os.listdir(ring_dir)):
        if not name.startswith("hires."):
            continue
        a = np.asarray(Image.open(os.path.join(ring_dir, name)).convert("RGBA")).astype(int)
        opaque = a[..., 3] > 128
        if not opaque.any():
            continue
        rgb = a[..., :3][opaque]
        spread = float((rgb.max(axis=1) - rgb.min(axis=1)).mean())
        if best is None or spread < best[0]:
            best = (spread, os.path.join(ring_dir, name))
    return best[1] if best else None


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
    overrides: dict | None = None,
) -> dict:
    overrides = overrides or {}
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
        manual = overrides.get(f"personnel.{fam}", {}).get("iconSlots")
        if manual:
            slots_by_family[fam] = [dict(s) for s in manual]
            log(f"slots {fam}: from template_overrides.json {manual}")
            continue
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
    def clean_cy_for(fam: str) -> float:
        slots = slots_by_family[fam]
        step = (slots[1]["cy"] - slots[0]["cy"]) if len(slots) > 1 else 0.07
        return slots[-1]["cy"] + step

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
            clean_cy = clean_cy_for(fam)
            donor = group_medians.get(("ship", fam, variant)) if ctype == "personnel" else group_medians.get(("personnel", fam, variant))
            # every slot is rebuilt from clean texture: the other type's median where that slot is
            # clean there, else the column texture below the last slot
            for s in slots:
                if slot_diff(base, s, W, H, clean_cy) < 12:
                    continue  # already plain texture
                use = donor if donor is not None and slot_diff(donor, s, W, H, clean_cy) < 12 else None
                step_px = int(round((clean_cy - s["cy"]) * H))
                notes.append(f"slot@{s['cy']}:{patch_slot(base, s, W, H, use, step_px)}")
        if ctype == "personnel" and fam == "std":
            # the older sets' erased skill bullets leave pale halos at the top-left of the text
            # box; copy the parchment from further right over that strip
            x0, y0, x1, y1 = int(0.155 * W), int(0.595 * H), int(0.26 * W), int(0.69 * H)
            shift = int(0.11 * W)
            base[y0:y1, x0:x1] = base[y0:y1, x0 + shift : x1 + shift].copy()
            notes.append("skill-halo:shift")
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
                clean_cy = clean_cy_for(fam)
                # the median first; if its sockets washed out, any member frame with a socket
                # the socket whose dark gap is darkest holds the smallest icon, so its ring crop
                # carries no icon remnant
                sources = [med] + [load(i) for i in idxs]
                best_ring = None
                for src in sources:
                    for s in slots:
                        if not socket_present(src, s, W, H, clean_cy):
                            continue
                        gap = socket_bands(src, s, W, H)[0]
                        if best_ring is None or gap < best_ring[0]:
                            best_ring = (gap, src, s)
                if best_ring is not None:
                    _gap, src, hit = best_ring
                    r_outer = hit["size"] * W / 2 * 0.97  # stay inside the ring's outer edge
                    ring = crop_ring(src, hit["cx"] * W, hit["cy"] * H, r_outer, RING_INNER * r_outer)
                    rings[rkey] = f"rings/{fam}.{variant}.png"
                    Image.fromarray(ring, "RGBA").save(os.path.join(out, rings[rkey]))
                free(idxs)
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
    def ref_inner(ref: np.ndarray) -> np.ndarray:
        h, w = ref.shape[:2]
        return crop_disc(ref[..., :3], (w - 1) / 2, (h - 1) / 2, REF_INNER * w)

    other_refs = {k: ref_inner(v) for k, v in refs.items() if k in OTHER_ICONS}
    best: dict[str, tuple[float, np.ndarray]] = {}
    matched_review: list[tuple[np.ndarray, str]] = []
    unmatched_review: list[tuple[np.ndarray, str]] = []
    if other_refs:
        fam = "hires" if "hires" in slots_by_family else "std"
        slots = slots_by_family.get(fam, [])
        clean_cy = clean_cy_for(fam)
        for i, fr in enumerate(frames):
            if fr["type"] not in ("personnel", "ship") or fr["family"] != fam:
                continue
            arr = load(i)
            H, W = arr.shape[:2]
            for si, s in enumerate(slots):
                if not socket_present(arr, s, W, H, clean_cy):
                    continue
                r = s["size"] * W / 2 * RING_INNER
                crop = crop_disc(arr, s["cx"] * W, s["cy"] * H, r)
                name, dist = nearest_reference(crop, other_refs)
                lab = f"{name} {dist:.0f} {fr['id'][-7:]}/{si}"
                if dist <= SOCKET_MATCH_MAX:
                    # the most canonical crop per name is the closest match; sharpness breaks ties
                    score = -dist + sharpness(crop) * 1e-4
                    if name not in best or score > best[name][0]:
                        best[name] = (score, crop)
                    matched_review.append((crop, lab))
                else:
                    unmatched_review.append((crop, lab))
            free([i])
        for name, (_sh, crop) in sorted(best.items()):
            file = f"icons/big-{name}.png"
            Image.fromarray(crop, "RGBA").save(os.path.join(out, file))
            extra_icons.append({"id": f"big-{name}", "file": file, "w": crop.shape[1], "h": crop.shape[0], "group": "other"})
        missing = sorted(set(OTHER_ICONS) - set(best))
        for name in missing:
            # no card in the sources carries it: use the rulebook's own (smaller) image
            crop = other_refs[name]
            file = f"icons/big-{name}.png"
            Image.fromarray(crop, "RGBA").save(os.path.join(out, file))
            extra_icons.append({"id": f"big-{name}", "file": file, "w": crop.shape[1], "h": crop.shape[0], "group": "other"})
        log(f"socket icons: {sorted(best)}; from rulebook (no source card): {missing}; unmatched crops {len(unmatched_review)}")
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
        missing_m = sorted(set(AFFILIATION_ICONS) - set(best_m))
        from_corner: list[str] = []
        for name in missing_m:
            # no source mission lists this affiliation: take the emblem out of the corner disc of
            # that affiliation's personnel frames (HiRes, else standard), else the rulebook's small image
            fam, med = personnel_median(group_medians, name)
            if fam == "hires":
                h, w = med.shape[:2]
                box = (int(CORNER_EMBLEM[0] * w), int(CORNER_EMBLEM[1] * h), int(CORNER_EMBLEM[2] * w), int(CORNER_EMBLEM[3] * h))
                crop = tight_crop(crop_box_rgba(med, box, dark=60))
                from_corner.append(name)
            elif fam == "std":
                disc = corner_disc(med, fam)
                crop = tight_crop(crop_box_rgba(disc, (0, 0, disc.shape[1], disc.shape[0]), dark=60))
                from_corner.append(name)
            elif name in aff_refs:
                crop = aff_refs[name]
            else:
                log(f"mission icon {name}: no personnel frame and no rulebook image, skipped")
                continue
            file = f"icons/mission-{name}.png"
            Image.fromarray(crop, "RGBA").save(os.path.join(out, file))
            extra_icons.append({"id": f"mission-{name}", "file": file, "w": crop.shape[1], "h": crop.shape[0], "group": "missionAffiliation"})
        log(f"mission icons: {sorted(best_m)}; from personnel corner disc: {from_corner}; from rulebook: {sorted(set(missing_m) - set(from_corner))}")
        if review:
            mission_review.sort(key=lambda t: t[1])
            _sheet(mission_review[:240], os.path.join(review_dir, "icons_mission.png"))

    extra_icons.sort(key=lambda i: i["id"])
    # ---- high-resolution inline icons: a silver socket ring around the emblem disc ----
    hi_files: dict[str, str] = {}
    ring_src = cleanest_ring(os.path.join(out, "rings"))
    if ring_src:
        log(f"hi-res inline ring source: {os.path.basename(ring_src)}")
        ring_img = Image.open(ring_src).convert("RGBA").resize((HI_SIZE, HI_SIZE), Image.LANCZOS)

        def compose(disc: np.ndarray) -> Image.Image:
            d = int(HI_SIZE * HI_DISC)
            disc_img = Image.fromarray(disc, "RGBA").resize((d, d), Image.LANCZOS)
            canvas = Image.new("RGBA", (HI_SIZE, HI_SIZE), (0, 0, 0, 0))
            canvas.paste(disc_img, ((HI_SIZE - d) // 2, (HI_SIZE - d) // 2), disc_img)
            canvas.alpha_composite(ring_img)
            return canvas

        # Other Icons: the socket crops already are emblem-on-dark discs
        for name, (_score, crop) in best.items():
            img = compose(crop)
            file = f"icons/hi-{name}.png"
            img.save(os.path.join(out, file))
            hi_files[name] = file
        # affiliations: the disc behind the corner emblem of that affiliation's personnel frames, HiRes first
        for (ctype, fam, variant), med in sorted(group_medians.items(), key=lambda kv: (kv[0][0], kv[0][1] != "hires", kv[0][2])):
            if ctype != "personnel" or variant in hi_files:
                continue
            img = compose(corner_disc(med, fam))
            file = f"icons/hi-{variant}.png"
            img.save(os.path.join(out, file))
            hi_files[variant] = file
        log(f"hi-res inline icons: {sorted(hi_files)}")

    skills = collect_skills(roles_by_frame)
    log(f"skills ({len(skills)}): {skills}")
    return {"frames": base_frames, "icons": extra_icons, "skills": skills, "hi": hi_files}
