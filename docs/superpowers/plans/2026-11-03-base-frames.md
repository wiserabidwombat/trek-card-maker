# Base Frames with App-Drawn Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One clean base frame per card type and variant; Other Icons, mission affiliations and skills chosen from lists and drawn by the app.

**Architecture:** The Python extractor gains pass 3 (variants, base-frame synthesis, slot measurement, full-size icon crops) and emits a catalog that lists only base frames. The app model gains `icons: string[]` and structured skills, the renderer draws rings + icons into template slots, and the editor swaps the thumbnail picker for variant tiles plus icon/skill lists. Deck JSON moves to v2 with a v1 migration.

**Tech Stack:** Python 3.13 (PyMuPDF, Pillow, NumPy, pytest); Vite + React 19 + TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-base-frames-design.md`

## Global Constraints

- Extractor runs as `python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --rulebook "C:/Users/altil/Downloads/rulebook.pdf" --out public/frames --review`.
- PDFs are untrusted input: read only with PyMuPDF; scripts live in `tools/`.
- Template geometry comes from measurement, never hard-coded in `src/`.
- Catalog fields `affiliation`, `set`, `sourceTitle` stay on frames (loader compatibility).
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Keep `src/model/card.ts` as the single source for field definitions.

---

## File map

| File | Responsibility |
|---|---|
| `tools/rulebook_icons.json` (new) | page + index → reference icon name |
| `tools/refs.py` (new) | load reference icons from the rulebook PDF; `nearest_reference(crop, refs)` |
| `tools/variants.py` (new) | `mission_variant(img)`, `dilemma_variant(img)`, `pick_family(groups)` |
| `tools/slots.py` (new) | `detect_slots(frames, column)` → list of (cx, cy, size); `detect_strip(frames, band)` |
| `tools/baseframe.py` (new) | `median_frame`, `patch_slot`, `clean_strip`, `fill_art_box` |
| `tools/iconcrop.py` (new) | `socket_present`, `crop_disc`, `crop_ring`, `strip_blobs`, `sharpness` |
| `tools/extract_frames.py` (modify) | pass 3 orchestration, catalog output |
| `tools/template_overrides.json` (modify) | slot / strip overrides if detection is off |
| `tools/tests/test_*.py` (new) | unit tests per module |
| `src/catalog/types.ts`, `loader.ts` (modify) | `variant`, `label`, `ring`, `iconSlots`, `missionAffiliations`, `skills`, icon `group` |
| `src/model/skills.ts` (new) | `STANDARD_SKILLS`, `skillText`, `parseSkillText` |
| `src/model/card.ts` (modify) | `Skill {name,count}`, `icons`, `maxIcons(type, template)` |
| `src/store/deckJson.ts` (modify) | v2 + v1 migration; `remapFrames` |
| `src/render/iconLayout.ts` (new) | `missionIconPositions(n, cy, step, size, W, H)` |
| `src/render/renderCard.ts` (modify) | slots, rings, mission strip, skill text |
| `src/editor/FramePicker.tsx` (rewrite) | variant tiles |
| `src/editor/IconsSection.tsx` (new) | checklist + ordered chips |
| `src/editor/SkillsEditor.tsx` (rewrite) | select + count + custom |
| `src/editor/FieldsForm.tsx`, `App.tsx`, `SetupScreen.tsx` (modify) | wiring, remap on load |
| `README.md`, spec status | docs |

---

### Task 1: Reference icons from the rulebook

**Files:** Create `tools/rulebook_icons.json`, `tools/refs.py`, `tools/tests/test_refs.py`.

**Interfaces:**
- Produces `load_reference_icons(rulebook_path, names_json) -> dict[str, np.ndarray]` (RGBA 45 px), `nearest_reference(crop_rgba, refs, size=32) -> tuple[str, float]`.

- [ ] **Step 1: Failing test for nearest match with circular mask**

```python
# tools/tests/test_refs.py
import numpy as np
from refs import nearest_reference, circular_mask

def _disc(colour, size=40):
    a = np.zeros((size, size, 4), np.uint8); a[..., :3] = colour; a[..., 3] = 255
    return a

def test_nearest_reference_picks_closest_colour():
    refs = {"red": _disc((220, 30, 30)), "blue": _disc((30, 30, 220))}
    name, dist = nearest_reference(_disc((200, 40, 40), 60), refs)
    assert name == "red" and dist < 40

def test_circular_mask_ignores_corners():
    m = circular_mask(32)
    assert not m[0, 0] and m[16, 16]
```

- [ ] **Step 2: Run** `python -I -X utf8 -m pytest tools/tests/test_refs.py -q` → ImportError.

- [ ] **Step 3: Implement `tools/refs.py`**

```python
"""Reference icons from the rulebook PDF and nearest-match naming of crops."""
from __future__ import annotations
import json, os
import numpy as np, pymupdf
from PIL import Image

def circular_mask(size: int) -> np.ndarray:
    yy, xx = np.mgrid[:size, :size]
    c = (size - 1) / 2
    return (xx - c) ** 2 + (yy - c) ** 2 <= (size * 0.42) ** 2

def _to_rgb(a: np.ndarray, size: int) -> np.ndarray:
    im = Image.fromarray(a, "RGBA").resize((size, size), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    return arr[..., :3] * alpha  # premultiplied so transparent areas are black on both sides

def nearest_reference(crop: np.ndarray, refs: dict[str, np.ndarray], size: int = 32) -> tuple[str, float]:
    m = circular_mask(size)
    c = _to_rgb(crop, size)[m]
    best, best_d = "", float("inf")
    for name, ref in refs.items():
        d = float(np.sqrt(((c - _to_rgb(ref, size)[m]) ** 2).sum(axis=1).mean()))
        if d < best_d: best, best_d = name, d
    return best, best_d

def load_reference_icons(rulebook: str, names_json: str) -> dict[str, np.ndarray]:
    with open(names_json, encoding="utf-8") as f: spec = json.load(f)
    doc = pymupdf.open(rulebook); out = {}
    for page_no, names in spec.items():
        page = doc[int(page_no) - 1]; seen = []
        for im in page.get_images(full=True):
            xref, w, h = im[0], im[2], im[3]
            if not (40 <= w <= 50 and 40 <= h <= 50) or xref in seen: continue
            seen.append(xref)
        for xref, name in zip(seen, names):
            if not name: continue
            pix = pymupdf.Pixmap(doc, xref)
            if pix.n - pix.alpha != 3: pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            img = Image.frombytes("RGBA" if pix.alpha else "RGB", (pix.width, pix.height), pix.samples).convert("RGBA")
            out[name] = np.asarray(img).copy()
    return out
```

`tools/rulebook_icons.json` (order verified in Step 5):

```json
{ "3": ["command","staff","past","alternate","future","deep-space-nine","earth","maquis","terok-nor","next-generation","original-series","voyager"],
  "5": ["headquarters","planet","space"],
  "6": ["dual","dilemma-planet","dilemma-space","bajoran","borg","cardassian","dominion","federation","ferengi","klingon","romulan","starfleet","non-aligned"] }
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Verify order** with a scratch script that saves a contact sheet of `load_reference_icons(...)` labelled by name; fix the JSON if any label is wrong.
- [ ] **Step 6: Commit** `feat(tools): rulebook reference icons`.

---

### Task 2: Variant classification and family choice

**Files:** Create `tools/variants.py`, `tools/tests/test_variants.py`.

**Interfaces:** `mission_variant(img) -> "planet"|"space"`, `dilemma_variant(img) -> "dual"|"planet"|"space"`, `pick_family(members: list[dict]) -> str`. Regions (fractions): mission disc `(0.045,0.035,0.105,0.075)`; dilemma ring annulus sample `(0.028,0.085,0.045,0.100)` (left of the disc, on the coloured ring).

- [ ] **Step 1: Tests**

```python
import numpy as np
from variants import mission_variant, dilemma_variant, pick_family

def _img(colour, size=(100, 70)):
    a = np.zeros((size[0], size[1], 3), np.uint8); a[...] = colour; return a

def test_mission_variant():
    assert mission_variant(_img((60, 170, 230))) == "planet"
    assert mission_variant(_img((10, 10, 25))) == "space"

def test_dilemma_variant():
    assert dilemma_variant(_img((40, 170, 150))) == "dual"
    assert dilemma_variant(_img((210, 60, 60))) == "planet"
    assert dilemma_variant(_img((230, 140, 40))) == "space"

def test_pick_family_prefers_hires():
    assert pick_family([{"family": "std"}, {"family": "hires"}]) == "hires"
    assert pick_family([{"family": "std"}]) == "std"
```

- [ ] **Step 2: Run → fail. Step 3: Implement** (mean colour of region; mission: `b > 120 and b > r + 40` → planet; dilemma: hue via `colorsys.rgb_to_hsv`: 140–200° → dual, <20° or >330° → planet, else space). **Step 4: tests pass. Step 5: commit** `feat(tools): mission and dilemma variants`.

---

### Task 3: Slot and strip detection

**Files:** Create `tools/slots.py`, `tools/tests/test_slots.py`.

**Interfaces:** `detect_slots(frames: list[np.ndarray], column=(0.0, 0.52, 0.16, 0.95), threshold=18.0, min_height=0.03) -> list[dict(cx, cy, size)]` (fractions of W/H; size = blob height / W as fraction of width), `detect_strip(frames, band=(0.0, 0.84, 1.0, 0.94)) -> dict(cy, step, size)`.

- [ ] **Step 1: Test with synthetic frames**: 6 frames 200×300, a 30 px disc at (20, 170) in 3 of them and at (20, 210) in 2 of them; expect two slots with `cy ≈ 170/300`, `210/300`, `size ≈ 30/200`.
- [ ] **Step 2: Implement**: `std = stack.std(0).max(2)` inside the column; mask = `std > threshold` majority-filtered (reuse `artmask._majority3x3`); row projection → runs of rows with `mean > 0.15`; each run is a slot; `cx` from column projection of that run; `size` = run height / W. For `detect_strip`, same on the band but project columns to get blob x-centres across all frames; `step` = median gap between adjacent distinct centres (merge within 0.01); `size` = median blob width / W; `cy` = mean blob centre / H.
- [ ] **Step 3: tests pass; commit** `feat(tools): icon slot and strip detection`.

---

### Task 4: Base frame synthesis

**Files:** Create `tools/baseframe.py`, `tools/tests/test_baseframe.py`.

**Interfaces:** `median_frame(frames) -> np.ndarray`, `percentile_frame(frames, q) -> np.ndarray`, `fill_art_box(img, bbox_px, colour=(15,18,22))`, `slot_rect(slot, W, H, pad=1.25) -> (x0,y0,x1,y1)`, `socket_present(img, slot, W, H) -> bool` (mean brightness of the annulus `0.85–1.05·r` > 150 and std of inner disc > 25), `patch_slot(img, slot, W, H, donor: np.ndarray | None, step_px: int)`, `clean_strip(img, band_px, frames)`.

- [ ] **Step 1: Tests**: median of 5 frames where a bright disc appears in 2 → disc gone; `patch_slot` with donor copies the donor rectangle; without donor copies from `y + step_px`; `clean_strip` replaces a bright blob in one frame with the dark percentile.
- [ ] **Step 2: Implement; Step 3: tests pass; commit** `feat(tools): base frame synthesis`.

---

### Task 5: Full-size icon crops

**Files:** Create `tools/iconcrop.py`, `tools/tests/test_iconcrop.py`.

**Interfaces:** `crop_disc(img, cx, cy, r) -> RGBA np.ndarray` (circle alpha, soft 1 px edge), `crop_ring(img, cx, cy, r_outer, r_inner) -> RGBA`, `sharpness(rgba) -> float` (variance of Laplacian on grey), `strip_blobs(img, band_px, bright=90) -> list[(x0,y0,x1,y1)]` (connected components of bright pixels, min 12 px, padded 2 px; implement BFS on a downsampled mask or use `scipy`-free flood fill with NumPy labelling by iterative dilation—keep it simple: scan-line union-find).

- [ ] **Step 1: Tests**: `crop_disc` alpha is 0 at corners and 255 at centre; `crop_ring` alpha 0 at centre; `strip_blobs` finds two separated bright squares; `sharpness` higher for a checkerboard than a flat disc.
- [ ] **Step 2: Implement; Step 3: pass; commit** `feat(tools): icon crops`.

---

### Task 6: Pass 3 in the extractor

**Files:** Modify `tools/extract_frames.py` (after overlays, before catalog write), `tools/template_overrides.json`.

- [ ] **Step 1: Add `--rulebook` argument**; load refs when given (else log a warning and skip naming/headquarters).
- [ ] **Step 2: Variants**: for every frame, `variant` = affiliation (personnel/ship), `mission_variant`/`dilemma_variant` (loaded from the saved JPEG), else `default`. Group by `(type, variant)`; `fam = pick_family(members)`; keep only members of that family (up to 40).
- [ ] **Step 3: Slots**: per `(type, family)` for personnel and ship: `detect_slots` over the family's frames of the largest affiliation group; store `templates[key]["iconSlots"]`. Mission: `detect_strip` → `templates["mission.<fam>"]["missionAffiliations"]`. Apply overrides (`deep_merge`) afterwards as today.
- [ ] **Step 4: Base frames**: `median_frame` → `fill_art_box` (bbox from `art_box_px[type.fam]`) → per slot, if `socket_present` then `patch_slot` with donor = median of the ship group of the same family+affiliation if that donor has no socket there, else `None` → mission: `clean_strip`. Headquarters: copy of the mission `space` base with the `headquarters` reference icon resized to the disc (disc centre/radius from the mission template's ring: `(0.075, 0.055)`, r `0.030·W`; measure once and put in `template_overrides.json` as `missionType`). Save JPEG + thumb. Review image: before/after side by side.
- [ ] **Step 5: Rings and socket icons**: for each personnel/ship group median, `crop_ring` at slot 1 (`r_outer = size/2 · W`, `r_inner = 0.72 · r_outer`) → `rings/<fam>.<aff>.png`. For each frame and slot with `socket_present`, `crop_disc` at `r_inner`; `nearest_reference` against the twelve Other Icons; accept if `dist < 55` (tune with the review sheet); keep the sharpest per name → `icons/big-<name>.png` with `"group": "other"`. Unmatched → review sheet.
- [ ] **Step 6: Mission affiliation icons**: `strip_blobs` on each mission frame's band; crop with transparency (alpha from brightness > 40, 2 px feather); name by nearest affiliation reference, accept `dist < 60`; sharpest per name → `icons/mission-<aff>.png`, `"group": "missionAffiliation"`.
- [ ] **Step 7: Catalog**: `frames` = base frames only (`id = "<type>.<variant>"`, `label` = title-cased variant, `set = "base"`, `affiliation` = variant for personnel/ship else `"none"`, `overlay` from the group's overlay file, `ring`), `icons` with `group` (`inline` for the old 31 px ones), `skills` = sorted list of the 23 names collected from skill lines (count ≥ 5 occurrences, title-case, `Ofﬁcer` ligature normalised).
- [ ] **Step 8: Run the extractor with `--review`** (background, ~6 min). Inspect `review/base_*.png`, `review/icons_sockets.png`, `review/icons_unmatched.png`, `review/icons_mission.png`. Fix thresholds or add overrides until every base frame is clean and all twelve Other Icons plus the affiliation icons are named.
- [ ] **Step 9: Commit** `feat(tools): base frame catalog (pass 3)`.

---

### Task 7: Catalog types and loader

**Files:** Modify `src/catalog/types.ts`, `src/catalog/loader.ts`, `src/catalog/loader.test.ts`.

- [ ] **Step 1: Test**: a catalog with a frame carrying `variant`, `label`, `ring` and a template with `iconSlots` and `missionAffiliations` validates; a frame without `variant` gets `variant = affiliation`, `label = id`; `skills` defaults to `[]`; icon `group` defaults to `'inline'`.
- [ ] **Step 2: Types**:

```ts
export interface IconSlot { cx: number; cy: number; size: number }
// Template: iconSlots?: IconSlot[] | null; missionAffiliations?: { cy: number; step: number; size: number } | null;
// Frame: variant: string; label: string; ring: string | null;
// IconDef: group: 'inline' | 'other' | 'missionAffiliation';
// Catalog: skills: string[];
export function framesOfType(c: Catalog, type: CardType): Frame[]
```

- [ ] **Step 3: Loader** fills defaults; tests pass; commit `feat(catalog): variants, slots, icon groups`.

---

### Task 8: Skills model and card model

**Files:** Create `src/model/skills.ts`, `src/model/skills.test.ts`; modify `src/model/card.ts`, `src/model/card.test.ts`.

- [ ] **Step 1: Tests**: `skillText({name:'Leadership',count:2})==='2 Leadership'`, count 1 → `'Leadership'`; `parseSkillText('2 Treachery')` → `{name:'Treachery',count:2}`, `'Chef'` → `{name:'Chef',count:1}`; `newCard` has `icons: []`; `changeType` keeps `icons` only when both types are personnel/ship, else `[]`; `maxIcons('personnel', template)` = `iconSlots.length`, mission → 5, other → 0.
- [ ] **Step 2: Implement**: `STANDARD_SKILLS` (23), `isStandardSkill`, `skillText`, `parseSkillText`; `Skill = { name: string; count: number }`; `Card.icons: string[]`.
- [ ] **Step 3: Fix compile errors** in `SkillsEditor`/`renderCard` minimally (next tasks rewrite them). Tests pass; commit `feat(model): structured skills and icon list`.

---

### Task 9: Deck JSON v2 and frame remap

**Files:** Modify `src/store/deckJson.ts`, `src/store/deckJson.test.ts`.

- [ ] **Step 1: Tests**: serialize writes `version: 2`; parse v2 round-trips `skills` and `icons`; parse v1 converts `{icon,text:'2 Honor'}` → `{name:'Honor',count:2}` and sets `icons: []`; `remapFrames(cards, catalog)` replaces unknown `frameId` with the first frame of the type and returns the count.
- [ ] **Step 2: Implement**; tests pass; commit `feat(store): deck JSON v2 with v1 migration`.

---

### Task 10: Renderer

**Files:** Create `src/render/iconLayout.ts`, `src/render/iconLayout.test.ts`; modify `src/render/renderCard.ts`.

- [ ] **Step 1: Test** `missionIconPositions(3, {cy:0.9, step:0.08, size:0.06}, 1000, 1400)` → x centres 420, 500, 580, y 1260, width 60.
- [ ] **Step 2: Implement** `missionIconPositions`; in `renderCard`: load `frame.ring` (if any) plus `card.icons`; after the overlay draw slots (personnel/ship: ring at `size·W`, icon at `0.72·size·W`) and mission strip (keep aspect: `h = w · img.naturalHeight / img.naturalWidth`); skills use `skillText` and the `skill-dot` icon.
- [ ] **Step 3: Tests + typecheck pass; commit** `feat(render): slot icons, mission affiliations, skill text`.

---

### Task 11: Editor

**Files:** Rewrite `src/editor/FramePicker.tsx`, `src/editor/SkillsEditor.tsx`; create `src/editor/IconsSection.tsx`; modify `FieldsForm.tsx`, `App.tsx`, `SetupScreen.tsx`, `src/index.css`.

- [ ] **Step 1: FramePicker**: type tabs; grid of `framesOfType(catalog, type)` tiles showing `thumb` and `label`; selected state; no filters.
- [ ] **Step 2: IconsSection** props `{ title, choices: IconDef[], value: string[], max: number, onChange }`: checklist buttons (image + id without prefix) toggling membership (append on check, block with a note at `max`), chip row with ↑ ↓ ×.
- [ ] **Step 3: SkillsEditor**: row = `<select>` (standard names + `Custom…`), count `<input type=number min=1 max=9>`, custom text input when the name is not standard; ↑ ↓ ×; add button.
- [ ] **Step 4: FieldsForm**: render `IconsSection` for personnel/ship (choices = icons with group `other`, `max = template.iconSlots?.length ?? 0`, title "Other icons") and mission (group `missionAffiliation`, max 5, title "Affiliations"); pass `template` in via props (App already has it).
- [ ] **Step 5: App**: on catalog ready, `remapFrames` stored cards (log the count in the status line); JSON import uses the same; `selectFrame` unchanged. SetupScreen command includes `--rulebook`.
- [ ] **Step 6: CSS**: `.variant-grid` (auto-fill 96 px tiles), `.icon-check` (40 px buttons, `.on` border), reuse `.chip`.
- [ ] **Step 7: `npm run test && npm run typecheck && npm run build`; commit** `feat(editor): variant picker, icon lists, skill picker`.

---

### Task 12: Browser verification, docs, memory

- [ ] **Step 1: Start `card-maker-dev`**, build a Federation personnel with command + Earth + TNG icons and skills (2 Leadership, Honor, custom "Chef"), a Klingon ship with staffing and past icon, a planet mission with four affiliations, a dual dilemma; screenshot each; check overflow badges.
- [ ] **Step 2: Export** a sheet and verify page count with the in-page pdf-lib check used before.
- [ ] **Step 3: README** (frame picking, icons, skills, `--rulebook`), spec status "implemented", memory note update.
- [ ] **Step 4: Commit** `docs: base frames usage`; report.
