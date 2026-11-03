# Trek Card Maker

A local web app for designing custom **Star Trek Customizable Card Game, Second Edition** cards.
Pick a clean base frame (one per card type and affiliation, built from The Continuing Committee's
free-to-print virtual card PDFs), add the rulebook's *Other Icons*, staffing, mission affiliations
and skills from lists, fill in the card text, drop in your own artwork (with crop, zoom and
rotate), and export a US Letter print sheet (3×3 cards, 2.5"×3.5", cut marks) as a PDF at the
frames' native resolution.

Everything runs in your browser. Cards and images are stored in the browser's IndexedDB; a JSON
export lets you back them up or move them to another machine.

## Prerequisites

- Node.js 20+
- Python 3.11+ with `pip install -r tools/requirements.txt` (PyMuPDF, Pillow, NumPy, pytest)
- The TrekCC virtual-set PDFs (the "HiRes" versions give the sharpest frames). The flat-scan sets
  (for example *Timeless* and *Finding Our Way*) have no separate card images and are skipped.

## 1. Build the frame catalog (once)

```bash
python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --rulebook "C:/Users/altil/Downloads/rulebook.pdf" --out public/frames
```

Add `--review` to also write contact sheets into `public/frames/review/` (affiliation clusters,
template boxes, every base frame before/after cleaning, and the icon crops with the name each
was matched to). The extractor writes:

- `public/frames/<Set>/NNN.jpg` the per-card source frames (1022×1464 for HiRes sets, 744×1039
  for older ones); kept for the extractor itself, not listed in the catalog
- `public/frames/base/<type>.<variant>.jpg` one clean frame per card type and variant
  (affiliation for personnel and ships; planet/space/headquarters for missions;
  dual/planet/space for dilemmas). HiRes sources are preferred; the older sets fill the gaps
  (Vidiian personnel, the Ferengi ship). Icon sockets and mission affiliation icons are removed.
- `public/frames/rings/*.png` the empty socket ring per affiliation, drawn under each Other Icon
- `public/frames/icons/big-*.png` full-size Other Icons cropped from the frames and named by
  matching against the rulebook's icon list; `icons/mission-*.png` affiliation icons for the
  mission strip; the small `icons/*.png` stay for inline `{icon:…}` use
- `public/frames/overlays/*.png` the frame edges that overlap the art area, drawn back on top of your image
- `public/frames/catalog.json` the base frames, one layout template per card type and family
  (text boxes from the PDFs' own text layer, socket slots and strip geometry measured from the
  frames), the icon list with groups, and the skill vocabulary

`public/frames/` is generated and git-ignored. Hand corrections to a template go in
`tools/template_overrides.json`; inline icon names in `tools/icon_names.json`; rulebook label →
icon id in `tools/rulebook_icons.json`; affiliation colour centres in `tools/affiliation.py`.

## 2. Run the editor

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

- **Cards** (left): your saved cards, copy counts for the print sheet, PDF/JSON export and import.
- **Frame**: pick the card type, then the affiliation (or mission/dilemma type).
- **Artwork**: choose a PNG/JPEG/WebP, then *Adjust crop* to position, zoom and rotate it. The crop
  box matches the frame's art area; a warning appears if the crop is smaller than the printed area.
- **Card text**: fields depend on the card type. Game text supports `**bold**`, `*italic*`,
  `{icon:klingon}` (use *insert icon* for the list) and blank lines.
  - Personnel and ships: **Other icons** (command, staff, past, alternate, future, Deep Space
    Nine, Earth, Maquis, Terok Nor, The Next Generation, The Original Series, Voyager) go into
    the socket column in the order you pick them; the frame decides how many sockets there are.
  - Personnel: **Skills** from the 23 standard skills with a multiplier (prints as
    "2 Leadership"), or *Custom…* for a house skill.
  - Ships: staffing icons over the art. Missions: **Affiliations** (up to five, centred along the
    bottom), a quadrant letter, points, span and requirements. A **Headquarters label** (for
    example "Borg Headquarters") replaces the affiliation icons in the bottom strip, as on
    headquarters missions; leave points empty for those.
- **Preview**: live render; *Download PNG* saves the single card. A badge warns when game text
  had to be shrunk to fit.

## Fonts

The originals use Crillee (titles) and Futura Condensed (text), which are commercial. The app
bundles open lookalikes (Exo 2 and Fira Sans Condensed). If you own the originals, use **Fonts…**
to load your `.ttf`/`.otf` files; they are kept in the browser only.

## Known limitations

- The affiliation icon in the top-left corner belongs to the frame; changing it means picking the
  other affiliation's frame. Mission type and dilemma type are frame variants for the same reason.
- The headquarters mission frame comes from the single headquarters card in the HiRes sets.
- No source mission lists the Borg, so the Borg affiliation mark for missions is cut from the
  corner disc of the Borg personnel frames; Terok Nor appears on no source card and uses the
  rulebook's small image.
- Older (non-HiRes) sets had their skill bullets painted into the frame; the extractor erases them.
- Art is placed with "cover" semantics into a fixed rectangle per card type.
- Decks saved by the first version (per-card frames, free-text skills) load and import, but their
  cards move to the first base frame of their type: re-pick the affiliation and add the icons.

## Development

```bash
npm test            # vitest unit tests (model, markup, layout, catalog, export, store)
npm run typecheck
npm run build
cd tools && python -I -X utf8 -m pytest -q   # extractor unit tests
```

Design notes live in `docs/superpowers/specs/` and the implementation plan in `docs/superpowers/plans/`.

## Credits and fair use

Card frames are derived from The Continuing Committee's (trekcc.org) virtual expansions, which
are distributed for non-commercial print-and-play use. Star Trek is a trademark of CBS/Paramount.
This tool is for personal, non-commercial custom cards.
