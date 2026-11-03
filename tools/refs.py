"""Reference icons from the rulebook PDF and nearest-match naming of icon crops.

The rulebook's card-anatomy pages carry each icon as a separate ~45 px image placed just left of
its printed name, so every placement is named by the words to its right on the same line.
``rulebook_icons.json`` maps, per page, that printed label to the icon id.
"""

from __future__ import annotations

import json

import numpy as np
import pymupdf
from PIL import Image

REF_MIN_PT, REF_MAX_PT = 8.0, 16.0  # placed size of a reference icon on the page, in points
LABEL_REACH_PT = 120.0


def circular_mask(size: int) -> np.ndarray:
    yy, xx = np.mgrid[:size, :size]
    c = (size - 1) / 2
    return (xx - c) ** 2 + (yy - c) ** 2 <= (size * 0.42) ** 2


def _to_rgb(a: np.ndarray, size: int) -> np.ndarray:
    im = Image.fromarray(a, "RGBA").resize((size, size), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    return arr[..., :3] * alpha  # premultiplied: transparent areas compare as black on both sides


def nearest_reference(crop: np.ndarray, refs: dict[str, np.ndarray], size: int = 32) -> tuple[str, float]:
    """Return (name, rms distance) of the reference icon closest to ``crop`` (both RGBA)."""
    m = circular_mask(size)
    c = _to_rgb(crop, size)[m]
    best, best_d = "", float("inf")
    for name, ref in refs.items():
        d = float(np.sqrt(((c - _to_rgb(ref, size)[m]) ** 2).sum(axis=1).mean()))
        if d < best_d:
            best, best_d = name, d
    return best, best_d


def match_label(words: list[str], mapping: dict[str, str]) -> str | None:
    """Accumulate words left to right until they spell a key of ``mapping`` (punctuation ignored)."""
    acc: list[str] = []
    for w in words:
        acc.append(w.strip(",.;:"))
        key = " ".join(acc)
        if key in mapping:
            return mapping[key]
        if w.endswith((",", ".", ";", ":")):
            break
    return None


def _xref_image(doc: pymupdf.Document, xref: int) -> np.ndarray:
    pix = pymupdf.Pixmap(doc, xref)
    if pix.n - pix.alpha != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    mode = "RGBA" if pix.alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples).convert("RGBA")
    return np.asarray(img).copy()


def load_reference_icons(rulebook: str, names_json: str) -> dict[str, np.ndarray]:
    with open(names_json, encoding="utf-8") as f:
        spec: dict[str, dict[str, str]] = json.load(f)
    doc = pymupdf.open(rulebook)
    out: dict[str, np.ndarray] = {}
    for page_no, mapping in spec.items():
        page = doc[int(page_no) - 1]
        words = page.get_text("words")
        for info in page.get_image_info(xrefs=True):
            x0, y0, x1, y1 = info["bbox"]
            if not (REF_MIN_PT <= x1 - x0 <= REF_MAX_PT):
                continue
            cy = (y0 + y1) / 2
            right = sorted(
                (w for w in words if x1 - 1 <= w[0] <= x1 + LABEL_REACH_PT and abs((w[1] + w[3]) / 2 - cy) < 4),
                key=lambda w: w[0],
            )
            name = match_label([w[4] for w in right], mapping)
            if name and name not in out:
                out[name] = _xref_image(doc, info["xref"])
    return out
