"""Extract card frames, overlays, icons and layout templates from TrekCC virtual-card PDFs.

Usage:
  python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" \
      --out public/frames [--review] [--limit N]

Pass 1 walks every PDF, saves each card image (JPEG + thumbnail), classifies it and records the
normalized text-line roles plus a colour feature vector for personnel/ship frames.
Pass 2 clusters the colour features into affiliations, derives one layout template per
(type, family), and computes an art box + edge overlay per (type, family, affiliation) group by
comparing the saved frames pixel-wise.

The PDFs are treated as untrusted input: this script only reads them with PyMuPDF.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
import sys
import time
from collections import defaultdict

import numpy as np
import pymupdf
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from affiliation import AFFILIATION_ALIASES, AFFILIATION_TABLE, cluster_colours, nearest_cluster, sample_features  # noqa: E402
from artmask import compute_art_mask, erase_red_dots  # noqa: E402
from cardsort import classify_type, derive_template, family_for, line_roles  # noqa: E402
from pass3 import build_base_catalog  # noqa: E402
from refs import load_reference_icons  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ICON_MIN, ICON_MAX = 8, 40
MAX_MASK_FRAMES = 40
DEFAULT_ART_BOX = [0.02, 0.12, 0.93, 0.52]
# Card border around the frame image, measured on the TrekCC sheets: HiRes sets place the
# 163.5 pt image 7.5 pt inside a black rounded rectangle (corner radius 7.08 pt) that makes the
# 178.6 x 249.5 pt (63 x 88 mm) card; the older sets bake that border into the image itself.
CARD_BORDER_PT = {"hires": {"borderPt": 7.5, "cornerPt": 7.08}, "std": {"borderPt": 0.0, "cornerPt": 0.0}}
STD_SKILL_REGION = (0.16, 0.60, 0.92, 0.73)


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def page_lines(page: pymupdf.Page) -> list[tuple[pymupdf.Rect, str, str, float]]:
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = line["spans"]
            text = "".join(s["text"] for s in spans).strip()
            if not text:
                continue
            out.append((pymupdf.Rect(line["bbox"]), text, spans[0]["font"], round(spans[0]["size"], 1)))
    return out


def pix_to_rgb(doc: pymupdf.Document, xref: int) -> np.ndarray:
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).copy()


def pix_to_rgba(doc: pymupdf.Document, xref: int) -> Image.Image:
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha and pix.n == 4:
        return Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
    rgb = pix if (pix.n == 3 and not pix.alpha) else pymupdf.Pixmap(pymupdf.csRGB, pix)
    img = Image.frombytes("RGB", (rgb.width, rgb.height), rgb.samples).convert("RGBA")
    return _knock_out_background(img)


def _knock_out_background(img: Image.Image) -> Image.Image:
    """Icons come without alpha; make a near-uniform corner colour transparent."""
    arr = np.array(img)
    corners = np.array([arr[0, 0, :3], arr[0, -1, :3], arr[-1, 0, :3], arr[-1, -1, :3]]).astype(int)
    if corners.std(axis=0).max() > 12:
        return img
    bg = corners.mean(axis=0)
    dist = np.abs(arr[..., :3].astype(int) - bg).sum(axis=2)
    arr[..., 3] = np.clip((dist - 20) * 12, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def norm_rect(r: pymupdf.Rect, card: pymupdf.Rect) -> tuple[float, float, float, float]:
    return (
        round((r.x0 - card.x0) / card.width, 4),
        round((r.y0 - card.y0) / card.height, 4),
        round((r.x1 - card.x0) / card.width, 4),
        round((r.y1 - card.y0) / card.height, 4),
    )


def set_name(filename: str) -> str:
    base = os.path.splitext(os.path.basename(filename))[0]
    return base.replace("_HiRes", "").replace(" (1)", "")


def contact_sheet(frames: list[dict], out: str, label: str, path: str) -> None:
    members = frames[:16]
    cols = min(len(members), 8)
    rows = (len(members) + 7) // 8
    sheet = Image.new("RGB", (170 * cols, 262 * rows), "white")
    d = ImageDraw.Draw(sheet)
    for j, fr in enumerate(members):
        th = Image.open(os.path.join(out, fr["thumb"]))
        sheet.paste(th, (170 * (j % 8), 262 * (j // 8)))
        d.text((170 * (j % 8) + 2, 262 * (j // 8) + 244), fr["sourceTitle"][:22], fill="black")
    d.text((2, 2), label, fill="red")
    sheet.save(path)


def draw_template_review(img: Image.Image, t: dict, art_box: list[float], path: str) -> None:
    d = ImageDraw.Draw(img)
    W, H = img.size

    def R(b, colour, width=3):
        d.rectangle((b[0] * W, b[1] * H, b[2] * W, b[3] * H), outline=colour, width=width)

    for name, b in t["boxes"].items():
        R((b["x0"], b["y0"], b["x1"], b["y1"]), "red")
        d.text((b["x0"] * W, b["y0"] * H - 14), name, fill="red")
    fl = t["flow"]
    R((fl["x0"], fl["y0"], fl["x1"], fl["y1"]), "lime")
    R(art_box, "blue", 4)
    if t.get("skills"):
        s = t["skills"]
        R((s["x0"], s["y0"], s["x1"], s["y0"] + s["rowHeight"]), "yellow")
    if t.get("requirements"):
        r = t["requirements"]
        R((r["x0"], r["y0"], r["x1"], r["y1"]), "orange")
    img.thumbnail((700, 1000))
    img.save(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--rulebook", default="", help="rulebook PDF; names the icon crops and supplies missing icons")
    ap.add_argument("--review", action="store_true")
    ap.add_argument("--pass3-only", action="store_true", help="skip PDF reading; rebuild base frames from the last run's source_frames.json")
    ap.add_argument("--limit", type=int, default=0, help="max PDFs to process (0 = all)")
    args = ap.parse_args()

    out = os.path.abspath(args.out)
    for sub in ("icons", "overlays") + (("review",) if args.review else ()):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    icon_names = load_json(os.path.join(HERE, "icon_names.json"))
    overrides = load_json(os.path.join(HERE, "template_overrides.json"))
    refs = {}
    if args.rulebook:
        refs = load_reference_icons(args.rulebook, os.path.join(HERE, "rulebook_icons.json"))
        log(f"rulebook reference icons: {len(refs)}")
    else:
        log("warn: no --rulebook given; socket and mission icons will not be named")

    dump_path = os.path.join(out, "source_frames.json")
    if args.pass3_only:
        with open(dump_path, encoding="utf-8") as f:
            dump = json.load(f)
        return finish(args, out, overrides, refs, dump["frames"], dump["roles"], dump["templates"], {k: tuple(v) for k, v in dump["artBoxPx"].items()}, dump["families"], dump["inlineIcons"])

    pdfs = sorted(os.path.join(args.pdf_dir, f) for f in os.listdir(args.pdf_dir) if f.lower().endswith(".pdf"))
    if args.limit:
        pdfs = pdfs[: args.limit]

    # ---------------- pass 1 ----------------
    frames: list[dict] = []
    roles_by_frame: list[list] = []
    features: dict[int, tuple[int, ...]] = {}
    family_widths: dict[str, list[float]] = defaultdict(list)
    icons: dict[str, dict] = {}
    icon_review: list[tuple[str, Image.Image]] = []
    seen_sets: set[str] = set()

    for pdf in pdfs:
        sname = set_name(pdf)
        if sname in seen_sets:
            log(f"skip {os.path.basename(pdf)}: duplicate of set {sname}")
            continue
        try:
            doc = pymupdf.open(pdf)
        except Exception as e:  # noqa: BLE001
            log(f"skip {os.path.basename(pdf)}: cannot open ({e})")
            continue
        emitted_xrefs: set[int] = set()
        count_before = len(frames)
        set_dir = os.path.join(out, sname)
        for pno in range(len(doc)):
            page = doc[pno]
            lines = page_lines(page)
            for im in page.get_images(full=True):
                xref, w, h = im[0], im[2], im[3]
                if w < 400:
                    if ICON_MIN <= w <= ICON_MAX and ICON_MIN <= h <= ICON_MAX:
                        try:
                            icon = pix_to_rgba(doc, xref)
                        except Exception:  # noqa: BLE001
                            continue
                        digest = hashlib.md5(icon.tobytes()).hexdigest()[:8]
                        if digest in icons:
                            continue
                        name = icon_names.get(digest, f"icon-{digest}")
                        file = f"icons/{name}.png"
                        icon.save(os.path.join(out, file))
                        icons[digest] = {"id": name, "file": file, "w": icon.width, "h": icon.height}
                        icon_review.append((digest, icon))
                    continue
                fam = family_for(w, h)
                if fam is None or xref in emitted_xrefs:
                    continue
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                rect = rects[0]
                emitted_xrefs.add(xref)
                family_widths[fam].append(rect.width)
                inside = [(norm_rect(r, rect), t, f, s) for r, t, f, s in lines if rect.contains(r)]
                ctype = classify_type(inside)
                roles = line_roles(ctype, inside)
                title = next((l[1] for r, l in roles if r == "title"), "")

                arr = pix_to_rgb(doc, xref)
                if fam == "std" and ctype == "personnel":
                    # older sets bake the skill bullets into the frame image; remove them
                    erase_red_dots(arr, STD_SKILL_REGION)
                idx = len(frames)
                nnn = f"{idx - count_before + 1:03d}"
                os.makedirs(os.path.join(set_dir, "thumbs"), exist_ok=True)
                img = Image.fromarray(arr, "RGB")
                img.save(os.path.join(set_dir, f"{nnn}.jpg"), quality=92, subsampling=0)
                th = img.copy()
                th.thumbnail((400, 240))
                th.save(os.path.join(set_dir, "thumbs", f"{nnn}.jpg"), quality=85)
                if ctype in ("personnel", "ship"):
                    features[idx] = sample_features(arr, fam)
                frames.append(
                    {
                        "id": f"{sname}-{nnn}",
                        "set": sname,
                        "type": ctype,
                        "family": fam,
                        "affiliation": "none",
                        "sourceTitle": title.lstrip("\u2022").strip(),
                        "w": int(w),
                        "h": int(h),
                        "file": f"{sname}/{nnn}.jpg",
                        "thumb": f"{sname}/thumbs/{nnn}.jpg",
                        "overlay": None,
                        "artBox": None,
                    }
                )
                roles_by_frame.append(roles)
        n = len(frames) - count_before
        if n == 0:
            log(f"skip {os.path.basename(pdf)}: no card images with a text layer (flat scan?)")
        else:
            seen_sets.add(sname)
            log(f"{sname}: {n} cards")

    # ---------------- pass 2: affiliations ----------------
    cluster_review: dict[str, dict] = {}
    for fam in ("hires", "std"):
        idxs = [i for i, v in features.items() if frames[i]["family"] == fam]
        if not idxs:
            continue
        clusters = cluster_colours([features[i] for i in idxs], tol=36.0)
        for k, (centre, members) in enumerate(clusters):
            raw = (
                nearest_cluster(centre, AFFILIATION_TABLE, fam)
                if any(key.startswith(fam + ":") for key in AFFILIATION_TABLE)
                else f"cluster-{fam}-{k}"
            )
            name = AFFILIATION_ALIASES.get(raw, raw)
            for m in members:
                frames[idxs[m]]["affiliation"] = name
                frames[idxs[m]]["cluster"] = raw
            cluster_review[f"{fam}-{k}"] = {
                "centre": list(centre),
                "name": name,
                "count": len(members),
                "examples": [frames[idxs[m]]["id"] for m in members[:6]],
            }
            if args.review:
                contact_sheet(
                    [frames[idxs[m]] for m in members],
                    out,
                    f"{fam} cluster {k} -> {name} centre={list(centre)} n={len(members)}",
                    os.path.join(out, "review", f"aff_{fam}_{k:02d}.png"),
                )
    if args.review:
        with open(os.path.join(out, "review", "affiliation_clusters.json"), "w", encoding="utf-8") as f:
            json.dump(cluster_review, f, indent=1)

    # ---------------- pass 2: templates ----------------
    families = {fam: {"refWidthPt": round(statistics.median(ws), 2)} for fam, ws in family_widths.items()}
    by_tf: dict[str, list[int]] = defaultdict(list)
    for i, fr in enumerate(frames):
        by_tf[f"{fr['type']}.{fr['family']}"].append(i)
    templates: dict[str, dict] = {}
    for key, idxs in by_tf.items():
        ctype, fam = key.split(".")
        templates[key] = derive_template(ctype, fam, [roles_by_frame[i] for i in idxs], families[fam]["refWidthPt"])

    # ---------------- pass 2: art boxes per (type, family), overlays per affiliation group ----------------
    MIN_GROUP = 4
    EDGE_BAND = 0.15
    by_group: dict[str, list[int]] = defaultdict(list)
    for i, fr in enumerate(frames):
        by_group[f"{fr['type']}.{fr['family']}.{fr['affiliation']}"].append(i)

    def load_group(idxs: list[int]) -> list[np.ndarray]:
        arrs: list[np.ndarray] = []
        shape = None
        for i in idxs[:MAX_MASK_FRAMES]:
            a = np.array(Image.open(os.path.join(out, frames[i]["file"])).convert("RGB"))
            if shape is None:
                shape = a.shape
            if a.shape == shape:
                arrs.append(a)
        return arrs

    art_box_px: dict[str, tuple[int, int, int, int]] = {}
    for key, idxs in by_tf.items():
        # the largest affiliation group has the most artwork variance and gives the reliable box
        groups = sorted((g for g in by_group if g.startswith(key + ".")), key=lambda g: -len(by_group[g]))
        for g in groups:
            arrs = load_group(by_group[g])
            if len(arrs) < 2:
                continue
            try:
                bbox, _ = compute_art_mask(arrs)
            except ValueError:
                continue
            art_box_px[key] = bbox
            h, w = arrs[0].shape[:2]
            templates[key]["artBox"] = [round(bbox[0] / w, 4), round(bbox[1] / h, 4), round(bbox[2] / w, 4), round(bbox[3] / h, 4)]
            break
        if key not in art_box_px:
            templates[key]["artBox"] = DEFAULT_ART_BOX
            log(f"warn: {key} has no usable group; using default art box")
        manual = overrides.get(key, {}).get("artBox")
        if manual and by_tf[key]:
            fr0 = frames[by_tf[key][0]]
            w, h = fr0["w"], fr0["h"]
            art_box_px[key] = (int(manual[0] * w), int(manual[1] * h), int(manual[2] * w), int(manual[3] * h))
            templates[key]["artBox"] = list(manual)

    for gkey, idxs in by_group.items():
        tf = gkey.rsplit(".", 1)[0]
        if len(idxs) < MIN_GROUP or tf not in art_box_px:
            continue
        arrs = load_group(idxs)
        if len(arrs) < MIN_GROUP:
            continue
        _bbox, overlay = compute_art_mask(arrs, bbox=art_box_px[tf], edge_band=EDGE_BAND)
        overlay_file = f"overlays/{gkey}.png"
        Image.fromarray(overlay, "RGBA").save(os.path.join(out, overlay_file))
        for i in idxs:
            frames[i]["overlay"] = overlay_file

    for key, t in templates.items():
        if key in overrides:
            t = deep_merge(t, overrides[key])
            templates[key] = t
        if args.review and by_tf[key]:
            fr = frames[by_tf[key][0]]
            img = Image.open(os.path.join(out, fr["file"])).convert("RGB")
            draw_template_review(img, t, t["artBox"], os.path.join(out, "review", f"template_{key}.png"))

    if args.review and icon_review:
        cols = 12
        sheet = Image.new("RGB", (80 * cols, 90 * ((len(icon_review) + cols - 1) // cols)), "white")
        d = ImageDraw.Draw(sheet)
        for i, (digest, icon) in enumerate(icon_review):
            big = icon.resize((64, 64))
            x, y = 80 * (i % cols), 90 * (i // cols)
            sheet.paste(big, (x + 8, y + 4), big)
            d.text((x + 4, y + 72), digest, fill="black")
        sheet.save(os.path.join(out, "review", "icons.png"))

    inline_icons = [dict(i, group="inline") for i in sorted(icons.values(), key=lambda i: i["id"])]
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(
            {"frames": frames, "roles": roles_by_frame, "templates": templates, "artBoxPx": art_box_px, "families": families, "inlineIcons": inline_icons},
            f,
        )
    return finish(args, out, overrides, refs, frames, roles_by_frame, templates, art_box_px, families, inline_icons)


def finish(args, out, overrides, refs, frames, roles_by_frame, templates, art_box_px, families, inline_icons) -> int:
    """Pass 3 and catalog output; also the entry point of --pass3-only."""
    if args.review:
        os.makedirs(os.path.join(out, "review"), exist_ok=True)
    # ---------------- pass 3: variants, base frames, rings, full-size icons ----------------
    base = build_base_catalog(frames, roles_by_frame, templates, art_box_px, out, refs, args.review, log, overrides)
    for key, t in templates.items():
        t["card"] = dict(CARD_BORDER_PT.get(key.split(".")[-1], CARD_BORDER_PT["std"]))
        if key in overrides:
            templates[key] = deep_merge(t, overrides[key])

    hi = base.get("hi", {})
    for ic in inline_icons:
        # the small inline icons keep their ids; a composed high-resolution twin is attached when one exists
        base_id = ic["id"][:-2] if ic["id"].endswith("-b") else ic["id"]
        if base_id in hi:
            ic["hi"] = hi[base_id]
    # ids that only exist as a composed icon (no small original in the PDFs, e.g. klingon) become inline icons too
    have = {ic["id"] for ic in inline_icons}
    for name, file in sorted(hi.items()):
        if name not in have:
            with Image.open(os.path.join(out, file)) as im:
                w, h = im.size
            inline_icons.append({"id": name, "file": file, "w": w, "h": h, "group": "inline", "hi": file})
    catalog = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "families": families,
        "templates": templates,
        "icons": inline_icons + base["icons"],
        "skills": base["skills"],
        "frames": base["frames"],
        "sourceFrames": len(frames),
    }
    with open(os.path.join(out, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=1)

    by_type: dict[str, int] = defaultdict(int)
    for fr in frames:
        by_type[fr["type"]] += 1
    log(f"done: {len(frames)} source frames -> {len(base['frames'])} base frames, {len(inline_icons)} inline icons, templates={sorted(templates)}")
    log("by type: " + ", ".join(f"{k}={v}" for k, v in sorted(by_type.items())))
    unresolved = sorted({fr["affiliation"] for fr in frames if fr["affiliation"].startswith("cluster-")})
    if unresolved:
        log(f"affiliation clusters still unnamed: {unresolved} (fill AFFILIATION_TABLE in affiliation.py)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
