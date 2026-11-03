# Star Trek CCG 2nd Edition Card Maker — Design

Date: 2026-11-02
Status: implemented 2026-11-02 (see README for usage)

## Goal

A local web app for designing custom Star Trek Customizable Card Game Second Edition cards.
The user picks a frame (card type + affiliation) taken from the free-to-print TrekCC "virtual"
card sheets, fills in the card's text fields, places and crops their own artwork, previews the
result at full resolution, and exports a US Letter print sheet (3×3 cards with cut marks) as PDF.

## Inputs we rely on

The TrekCC PDFs in `C:\Users\altil\Downloads\TrekCC` are built as *image + live text*:

| Set | Card image size | Text layer | Usable |
|-----|-----------------|------------|--------|
| FavorTheBold, ExtremeMeasures, Unity, FaceoftheEnemy, SacrificeofAngels (HiRes) | 1022×1464 CMYK | yes | yes |
| Caretaker, DiamondII, HeroesandDemons, Phage, RealmofFear, ContinuingMission, SecondSkin, WhereNoOneHasGoneBefore | 744×1039 CMYK | yes | yes |
| Timeless, FindingOurWay | 2550×3300 flat page scan | no | no |

Each embedded card image is the frame plus the original artwork with **no text**. Title, cost,
type bar, species/class, skills, game text, lore, attributes, points, span and collector info are
PDF text drawn on top, so the text layer gives exact box geometry and font sizes per card type.

Baked into the frame image (and therefore part of a chosen frame): the original artwork (covered
by the user's image), affiliation icon top-left, era icon strip (personnel), affiliation icons
at the bottom of missions, dilemma type icon. Ship staffing icons and the mission quadrant letter
sit inside the art area, so the app covers them with the user's image and draws its own (a
`staffing` icon list and a `quadrant` field, slots measured per family in
`tools/template_overrides.json`). Older (744×1039) sets also bake the skill bullets into the
frame; the extractor erases those red dots. Separate small images in the PDFs (skill bullets,
affiliation/era/staffing icons) are extracted as overlayable icons.

Fonts in the PDFs (Crillee, Futura Condensed family) are commercial and subset-embedded, so the
app ships with open lookalikes and a settings slot for user-supplied TTF/OTF files.

## Architecture

Two parts:

1. **Extraction tool** (`tools/extract_frames.py`, Python 3 + PyMuPDF + Pillow). Run once (or
   whenever new TrekCC PDFs are added). Reads every PDF in a directory and writes the frame
   catalog into `public/frames/`. Not part of the runtime app.
2. **Editor app** (Vite + React + TypeScript, client-only). Loads the catalog, edits cards,
   renders with the HTML canvas, persists to IndexedDB, exports PDF with `pdf-lib`.

Project root: `C:\Users\altil\agent-workspace\trek-card-maker`.

```
trek-card-maker/
  tools/extract_frames.py         PDF -> frames, thumbs, icons, catalog.json
  tools/requirements.txt
  public/frames/                  generated, git-ignored (derived from TrekCC images)
    catalog.json
    <set>/<nnn>.jpg               full-res frame (JPEG q92)
    <set>/thumbs/<nnn>.jpg        240px thumbnail
    icons/<name>.png              skill bullets and other overlay icons
  public/fonts/                   open lookalike fonts (bundled)
  src/
    catalog/      types + loader for catalog.json
    model/        Card data model, per-type field definitions, markup parser
    render/       pure canvas renderer (card -> HTMLCanvasElement)
    editor/       React UI: frame picker, field form, image cropper, live preview
    export/       sheet layout math + pdf-lib export
    store/        IndexedDB persistence, JSON import/export
  docs/superpowers/specs/
```

## Extraction tool

For each PDF, each page, each embedded image wider than 400 px:

- Get the image's placement rect on the page and the text lines inside that rect.
- Classify card type: the type-bar word (Dilemma / Event / Interrupt / Equipment); otherwise
  Personnel if attribute labels Integrity/Cunning/Strength appear; Ship if Range/Weapons/Shields
  appear; otherwise Mission.
- Classify **family** by image size: `hires` (1022×1464 ±2 px) or `std` (744×1039). Geometry
  differs slightly between families (aspect 0.698 vs 0.716), so layout boxes are stored per family.
- Infer **affiliation** for Personnel and Ship from the dominant hue of the title-bar strip and
  the top-left icon region, clustered into the known 2E palette (Bajoran, Borg, Cardassian,
  Dominion, Federation, Ferengi, Klingon, Romulan, Starfleet, Non-Aligned, and the extra
  Maquis/Terok Nor/Mirror variants if present). Clusters are reviewed by eye once and the mapping
  committed as a table in the script. Non-personnel/ship cards get affiliation `none`.
- Record, per card, the normalized text boxes (x0,y0,x1,y1 as fractions of the image rect), font
  name and size for each text line. Per (type, family) the script derives the **layout template**
  (title box, cost box, subtitle, type bar, skills origin + row height, game text box, lore style,
  attribute boxes, points, span, collector info) by taking the median of the per-card boxes.
  Templates are written into `catalog.json` so the app never hard-codes coordinates.
- Measure the **art box** per (type, family) from the frame image itself: the largest rectangle
  of the top half whose border pixels differ from the surrounding frame texture. Verified by eye
  on contact sheets and overridable in a small JSON of manual corrections.
- Convert CMYK to RGB, write full-res JPEG and 240 px thumbnail, and extract small images (≤ 64 px)
  once per distinct pixel content as PNG icons.
- Emit `catalog.json`:

```json
{
  "generatedAt": "...",
  "templates": { "personnel.hires": { "artBox": [0.02, 0.12, 0.95, 0.53], "title": {}, "...": {} } },
  "icons": [ { "id": "skill-red", "file": "icons/skill-red.png", "w": 26, "h": 26 } ],
  "frames": [
    { "id": "SacrificeofAngels-036", "set": "Sacrifice of Angels", "type": "personnel",
      "family": "hires", "affiliation": "bajoran", "sourceTitle": "Winn Adami",
      "w": 1022, "h": 1464, "file": "SacrificeofAngels/036.jpg",
      "thumb": "SacrificeofAngels/thumbs/036.jpg" }
  ]
}
```

Duplicate card images (same xref reused on a page) are emitted once. Cards from the flat-scan
PDFs are skipped with a logged reason.

## Card data model

```ts
type CardType = 'personnel'|'ship'|'equipment'|'event'|'interrupt'|'mission'|'dilemma';

interface Card {
  id: string; name: string; type: CardType; frameId: string;
  fields: Record<string, string>;       // keyed by field id from the type's field definition
  skills?: { icon: string; text: string }[];   // personnel only
  image?: { blobKey: string; crop: { x: number; y: number; w: number; h: number } }; // source px
  updatedAt: number;
}
```

Field definitions per type (what the form shows and what the renderer draws):

| Type | Fields |
|------|--------|
| all | title, unique (• prefix), gameText, lore, collectorInfo |
| personnel | cost, subtitle, species, skills[], integrity, cunning, strength |
| ship | cost, subtitle, shipClass, range, weapons, shields |
| equipment, event, dilemma | cost |
| interrupt | (no cost) |
| mission | subtitle, points, span, requirements |

Game text supports a tiny inline markup: `**bold**` for keywords and `*italic*`. Lore is always
drawn in the light italic style. The type bar text is automatic (the type name, species, or class).

## Renderer

`renderCard(card, assets) => HTMLCanvasElement` in `src/render/`, pure and framework-free.

- Canvas size = frame native size. Draw frame, then the user's image: the crop rect from the
  source image is drawn to the template art box with cover semantics (no distortion).
- Text boxes come from `catalog.templates[type.family]`. Font sizes in the catalog are PDF points
  relative to a 163.5 pt wide card; the renderer converts to canvas pixels by
  `px = size_pt / 163.5 * frame.w`.
- Word-wrapping supports mixed runs (regular/bold/italic). Game text + lore share one flow box;
  if the flow overflows, the renderer shrinks font size in 2% steps down to 70% before clipping,
  and reports `overflow: true` so the UI can warn.
- Skills render as rows of (bullet icon, skill name) laid out left to right with wrapping, like the
  originals. Attributes draw label + value in their fixed boxes.
- Font stack: `Crillee`-lookalike for titles/cost/points/span, condensed sans for body, loaded
  via `FontFace` from `public/fonts/` or from user-supplied files (stored in IndexedDB).

The same renderer serves the live preview (drawn scaled into a smaller canvas) and the export.

## Editor UI

Single page, three columns:

1. **Frame picker**: filter by card type and affiliation, thumbnail grid, hover shows set and
   source title. Changing type resets type-specific fields; changing frame within a type keeps them.
2. **Fields form**: inputs generated from the type's field definition; skills list with add/remove/
   reorder and bullet icon choice; image section with "Choose image" and "Adjust crop".
3. **Preview**: live canvas, overflow warning, "Download PNG" (free, since the canvas exists).

Image crop dialog: shows the chosen image with a fixed-aspect crop rectangle matching the art box.
User can drag, zoom (wheel/slider) and rotate in 90° steps. Small images (less than the art box in
pixels) show a quality warning. Implementation: `react-easy-crop`. Crop is stored in source pixels
so the renderer is independent of preview scale.

A **deck list** sidebar holds saved cards (new, duplicate, delete, rename) and the print-sheet
selection with per-card copy counts.

## Export

- Sheet: US Letter 612×792 pt, 3×3 grid of 178.58×249.45 pt (63×88 mm, as TrekCC prints; changed
  from 2.5"×3.5" on 2026-11-03 after measuring their sheets), no gutters, centered
  (36 pt left/right, 18 pt top/bottom margins). Cut marks: short hairlines in the margins aligned
  to every grid line, like the TrekCC sheets.
- Each selected card is rendered once at native size, encoded as JPEG (q 95), embedded with
  `pdf-lib`, and placed N times according to its copy count. Pages added as needed.
- Output downloaded as `<deck-name>-sheet.pdf`. Effective resolution ≥ 300 dpi (744 px / 2.5").

## Persistence

IndexedDB via `idb-keyval`: cards, image blobs, user fonts. Export/import whole deck as a `.json`
(images base64) for backup or moving between machines. Nothing leaves the browser.

## Error handling

- Catalog missing (extraction not run): app shows a setup screen with the exact command to run.
- Frame image fails to load: card shows a placeholder and an error badge; export skips it and lists
  skipped cards.
- Text overflow: warning badge; export still proceeds with the shrunk text.
- Unsupported image file: rejected with a message; accepted types are PNG, JPEG, WebP.

## Testing

- Vitest unit tests for: markup parser, word-wrap/run layout (with a stub text measurer), font
  size conversion, sheet layout math (positions, page count, cut-mark coordinates), catalog
  loader validation, deck JSON round-trip.
- Python: a pytest smoke test that runs the extractor on one PDF page from a fixture and checks
  classification, template derivation and output files.
- Manual: open the app, build one card of each type, crop an image, export a sheet, open the PDF.

## Out of scope (for now)

Card backs, A4 or other page sizes, printing bleed, editing the baked-in icons, 1st Edition cards,
sharing/online features, undo history beyond the browser form's own.
