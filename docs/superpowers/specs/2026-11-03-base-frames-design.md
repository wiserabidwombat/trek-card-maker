# Base Frames with App-Drawn Icons and Skills — Design

Date: 2026-11-03
Status: implemented 2026-11-03 (see README for usage)
Builds on: `2026-11-02-card-maker-design.md`

## Goal

Replace the 648 per-card source frames with one clean **base frame** per card type and variant
(affiliation for personnel and ships; mission type for missions; dilemma type for dilemmas), and
let the user add the rulebook's *Other Icons*, ship staffing icons, mission affiliation icons and
personnel skills from lists. The app draws every icon; nothing card-specific stays baked in.

## What the source frames bake in (and where it goes)

| Element | Source | New home |
|---|---|---|
| Affiliation icon (top-left) and frame colour/texture | personnel/ship frame | stays in the base frame; one base frame per affiliation |
| Other Icons column (left of the text box; sockets only where icons exist) | personnel/ship frame | cleaned out of the base frame; app draws ring + icon in measured slots |
| Ship staffing icons (over the art) | app already draws them | unchanged |
| Mission type icon (top-left ring: planet, space, headquarters) | mission frame | variant of the mission base frame |
| Mission affiliation icons (bottom strip, 0–5, centred) | mission frame | cleaned; app draws from a list |
| Dilemma type icon (top-left ring; ring and type bar colour follow the type) | dilemma frame | variant of the dilemma base frame (dual, planet, space) |
| Skill bullets | older frames (already erased) | app draws bullets |

## Rulebook icon vocabulary

Other Icons (personnel and ship): command, staff, past, alternate, future, Deep Space Nine,
Earth, Maquis, Terok Nor, The Next Generation, The Original Series, Voyager.
Mission types: headquarters, planet, space. Dilemma types: dual, planet, space.
Affiliations: Bajoran, Borg, Cardassian, Dominion, Federation, Ferengi, Klingon, Romulan,
Starfleet, Non-Aligned (plus Vidiian, which appears only in the older sets).

Skills (23, verified against every personnel in the PDFs): Acquisition, Anthropology, Archaeology,
Astrometrics, Biology, Diplomacy, Engineer, Exobiology, Geology, Honor, Intelligence, Law,
Leadership, Medical, Navigation, Officer, Physics, Programming, Science, Security, Telepathy,
Transporters, Treachery. Multiples print as `2 Treachery`.

## Extraction changes (`tools/`)

Pass 1 and the affiliation/template passes stay. A new pass 3 produces the base catalog. The
per-card source frames remain on disk under `public/frames/<Set>/` for the extractor's own use but
are no longer listed in `catalog.json`.

### Reference icons from the rulebook

`--rulebook <pdf>` reads the 45 px icon images on rulebook pages 3, 5 and 6. Their order on the
page matches the printed lists, so `tools/rulebook_icons.json` maps page+order to names
(`command`, `staff`, … `terok-nor`, `headquarters`, `planet`, `space`, `dual`, `bajoran`, …).
These are the **reference set** for naming crops; they are also used directly only where no
full-size crop exists (the headquarters mission icon).

### Variant classification

- Personnel/ship: variant = affiliation (existing clustering, aliases applied).
- Mission: variant from the mean colour of the inner disc of the top-left ring: bright blue →
  `planet`, dark → `space`. `headquarters` has no source card; its base frame is the `space`
  frame with the rulebook headquarters icon scaled into the disc (best effort, flagged in the log).
- Dilemma: variant from the hue of the ring annulus: teal → `dual`, red → `planet`, orange →
  `space`. Thresholds live in `tools/variants.py` and are checked by the review sheet.
- Event, equipment, interrupt: single variant `default`.

Family choice per variant: `hires` if any frame of that type+variant is HiRes, otherwise `std`.

### Base frame synthesis (`tools/baseframe.py`)

For each (type, variant) group, using up to 40 frames of the chosen family:

1. Start from the per-pixel **median** of the group. Everything constant (the frame) survives;
   artwork and sparse icons wash out.
2. **Art box**: fill with flat `#0f1216`; the group's existing edge overlay is applied by the app as
   before.
3. **Icon column** (personnel, ship): per-pixel median already removes sockets present in fewer
   than half of the cards. Slots still occupied in the median (slot 1 on personnel, where every
   card has staff or command) are patched: copy the same slot rectangle from the median of the
   **ship** group of the same family+affiliation when it has no socket there, otherwise copy the
   column texture from directly below the lowest slot (same width, shifted by one slot step).
4. **Mission bottom strip**: replace with the 25th percentile across frames (the strip is
   near-black space; icons are brighter outliers).
5. Save `base/<type>.<variant>.jpg` (q92) and `base/thumbs/<type>.<variant>.jpg`.

Review output (`--review`): `review/base_<type>.<variant>.png` side by side with the median before
cleaning, so a bad patch is visible.

### Slot measurement (`tools/slots.py`)

In the icon column of personnel and ship frames (x in 0–0.15), the per-pixel standard deviation
across the group's frames has blobs exactly where sockets come and go. Row projection of the blob
mask gives slot y-ranges; column projection gives the shared x-range. Result per type+family:
`iconSlots: [{cx, cy, size}]` ordered top to bottom (3 for personnel, 2 for ship), stored in the
template. Mission affiliation strip: `missionAffiliations: {cy, step, size}` measured from the
positions of icon blobs across missions (centre of the strip is the card's horizontal centre).
All values are overridable in `tools/template_overrides.json`.

### Full-size icon crops (`tools/iconcrop.py`)

- **Socket icons**: for every personnel/ship frame and every slot, test whether a socket is present
  (ring brightness on the annulus). If so, crop the inner disc (0.72 of the ring radius), make the
  outside transparent, and name it by nearest reference icon (RGB distance after scaling both to
  32 px, circular mask). Crops closer than `MATCH_MAX` are accepted; the sharpest (highest Laplacian
  variance) crop per name wins and is saved as `icons/<name>.png` at native size (~60 px HiRes).
  Unmatched crops go to `review/icons_unmatched.png` with their frame id and slot.
- **Rings**: for each personnel/ship family+affiliation, the slot-1 socket from the group's median
  with the inner disc made transparent → `rings/<family>.<affiliation>.png`. The app draws the ring
  then the icon.
- **Mission affiliation icons**: connected bright blobs in the bottom strip of mission frames,
  cropped with transparency, named by nearest reference affiliation icon → `icons/mission-<aff>.png`.
- **Mission type / dilemma type**: not cropped; they stay in the variant frames.
- The old 31 px inline icons stay in `icons/` under their existing ids for game-text markup; the
  socket crops use ids prefixed `big-` (`big-command`, `big-earth`, …) so both sizes coexist.

### Catalog shape

```json
{
  "frames": [
    { "id": "personnel.federation", "type": "personnel", "variant": "federation", "label": "Federation",
      "family": "hires", "w": 1022, "h": 1464, "file": "base/personnel.federation.jpg",
      "thumb": "base/thumbs/personnel.federation.jpg", "overlay": "overlays/personnel.hires.federation.png",
      "ring": "rings/hires.federation.png", "artBox": null, "affiliation": "federation",
      "set": "base", "sourceTitle": "" }
  ],
  "templates": { "personnel.hires": { "...": "existing", "iconSlots": [{ "cx": 0.066, "cy": 0.60, "size": 0.078 }, "..."] },
                 "mission.hires":   { "...": "existing", "missionAffiliations": { "cy": 0.905, "step": 0.075, "size": 0.062 } } },
  "icons": [ { "id": "big-command", "file": "icons/big-command.png", "w": 62, "h": 62, "group": "other" },
             { "id": "mission-federation", "file": "icons/mission-federation.png", "w": 64, "h": 48, "group": "missionAffiliation" },
             { "id": "klingon", "file": "icons/klingon.png", "w": 31, "h": 31, "group": "inline" } ],
  "skills": ["Acquisition", "Anthropology", "..."]
}
```

`Frame` keeps `affiliation`, `set` and `sourceTitle` so the loader stays backward compatible.

## App changes (`src/`)

### Model

```ts
interface Skill { name: string; count: number }          // custom skills are any name not in the list
interface Card { ...existing; skills: Skill[]; icons: string[] }
```

- `icons` holds Other Icons ids for personnel and ships (`big-*`, drawn in slot order) and
  affiliation icon ids for missions (`mission-*`, drawn centred in order). Empty for other types.
- `skillText(s)` → `"2 Leadership"` or `"Leadership"`.
- `STANDARD_SKILLS` constant (23 names) in `src/model/skills.ts`; the catalog's list, when present,
  wins so the extractor stays the source of truth.
- Deck JSON **version 2**. `parseDeck` accepts v1: skills `{icon, text}` are parsed with
  `/^(\d+)\s+(.+)$/` into `{name, count}`, `icons` defaults to `[]`, and a `frameId` that is not a
  base frame is replaced by the first base frame of the card's type (the importer reports how many
  cards were remapped). The same remap runs on cards loaded from IndexedDB.

### Renderer

After the overlay and before text:

1. Personnel/ship: for `card.icons.slice(0, slots.length)`, draw `frame.ring` then the icon at
   `iconSlots[i]` (ring at `size`, icon at `0.72 * size`), both centred.
2. Mission: `n = card.icons.length`; icon `i` is centred at
   `x = W/2 + (i - (n-1)/2) * step * W`, `y = cy * H`, scaled to `size * W` wide, aspect kept.
3. Skills: unchanged layout, text from `skillText`, bullet always `skill-dot`.

### Editor

- **FramePicker**: type tabs, then a grid of variant tiles (thumb + label). No affiliation
  select, no search.
- **IconsSection** (personnel, ship): checklist of the twelve Other Icons with thumbnails; checked
  icons appear as an ordered chip row with up/down/remove; adding beyond the slot count is
  blocked with a note ("3 slots on this frame").
- **IconsSection** (mission): same component over the affiliation icons, limit 5.
- **SkillsEditor**: each row is a `<select>` of the standard skills plus "Custom…", a count stepper
  (1–9, shown only when > 0), and a text input visible only for Custom. Reorder/remove as today.
- SetupScreen message updated for the `--rulebook` argument.

### Styling

Variant tiles reuse `.thumb`; chips reuse `.chip`; the icon checklist is a wrapped row of
40 px buttons with a selected state. No new theme tokens.

## Error handling

- Missing ring or icon file: skipped silently in render (as icons are today); the editor's
  checklist only lists icons present in the catalog.
- Group with fewer than 2 frames: base frame is the single frame with art box filled; logged.
- Unmatched socket crops never enter the catalog; they are listed in the review sheet.
- Deck import of v1: never fails on frame ids; remapped count reported.

## Testing

Python (`tools/tests/`): `test_baseframe.py` (median cleaning of synthetic sockets, slot-1 patch
from a donor, percentile strip clean), `test_slots.py` (slot detection from synthetic blobs),
`test_variants.py` (mission and dilemma variant thresholds on synthetic colours),
`test_iconcrop.py` (nearest-reference naming with a circular mask).

Vitest: `skills.test.ts` (text formatting, parsing of v1 text), `deckJson.test.ts` (v1 → v2
migration incl. frame remap), `renderCard` geometry helper `missionIconPositions(n, …)`,
`loader.test.ts` (new fields optional).

Manual (browser): one card of every type with icons and skills, a Federation personnel with three
Other Icons, a mission with four affiliations, and a sheet export.

## Implementation notes (2026-11-03)

- Socket geometry is measured once per family from the ring's radial brightness profile and kept
  in `tools/template_overrides.json` (HiRes: x 0.0651, y 0.6393/0.7107/0.7804, diameter 0.0793 W;
  older sets: x 0.102, y 0.6319/0.6983/0.7647, diameter 0.0753 W). The variance detector remains
  as the fallback when no override exists. Ships use the personnel slots from the second one down.
- The socket test compares a slot with the clean column texture below the last slot (plus a dark
  gap / bright ring check), so bronze and gold rings are detected like silver ones. Base frames
  rebuild every slot from that clean texture rather than relying on the median alone.
- Terok Nor appears on no source card and no source mission lists Borg; both icons fall back to
  the rulebook's 45 px images (smaller, visibly softer when printed).
- A headquarters mission exists in the sources (Face of the Enemy), so no synthetic frame was
  needed.
- Decks and stored cards from the first version are migrated on load: skills text is parsed,
  icons default to empty, and per-card frame ids move to the first base frame of the type.

## Out of scope

Editing the affiliation icon or frame colour independently of the variant; custom icon uploads;
reflowing the skills box for more than three rows; the three older-set-only layouts beyond what
the fallback family already provides.
