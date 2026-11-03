# Trek Card Maker

A local web app for designing custom **Star Trek Customizable Card Game, Second Edition** cards.
Pick a frame extracted from The Continuing Committee's free-to-print virtual card PDFs, fill in the
card text, drop in your own artwork (with crop, zoom and rotate), and export a US Letter print sheet
(3×3 cards, 2.5"×3.5", cut marks) as a PDF at the frames' native resolution.

Everything runs in your browser. Cards and images are stored in the browser's IndexedDB; a JSON
export lets you back them up or move them to another machine.

## Prerequisites

- Node.js 20+
- Python 3.11+ with `pip install -r tools/requirements.txt` (PyMuPDF, Pillow, NumPy, pytest)
- The TrekCC virtual-set PDFs (the "HiRes" versions give the sharpest frames). The flat-scan sets
  (for example *Timeless* and *Finding Our Way*) have no separate card images and are skipped.

## 1. Build the frame catalog (once)

```bash
python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --out public/frames
```

Add `--review` to also write contact sheets and template overlays into `public/frames/review/`
for checking affiliation clustering and text-box placement. The extractor writes:

- `public/frames/<Set>/NNN.jpg` full-resolution frames (1022×1464 for HiRes sets, 744×1039 for older ones)
- `public/frames/<Set>/thumbs/NNN.jpg` thumbnails for the picker
- `public/frames/overlays/*.png` the frame edges that overlap the art area, drawn back on top of your image
- `public/frames/icons/*.png` affiliation, staffing, era and skill-bullet icons for inline use
- `public/frames/catalog.json` every frame plus one layout template per card type and family,
  derived from the PDFs' own text layer (so text lands where the originals put it)

`public/frames/` is generated and git-ignored. Hand corrections to a template go in
`tools/template_overrides.json`; icon names in `tools/icon_names.json`; affiliation colour
centres in `tools/affiliation.py`.

## 2. Run the editor

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

- **Cards** (left): your saved cards, copy counts for the print sheet, PDF/JSON export and import.
- **Frame**: filter by card type and affiliation, search by the source card's title.
- **Artwork**: choose a PNG/JPEG/WebP, then *Adjust crop* to position, zoom and rotate it. The crop
  box matches the frame's art area; a warning appears if the crop is smaller than the printed area.
- **Card text**: fields depend on the card type. Game text supports `**bold**`, `*italic*`,
  `{icon:klingon}` (use *insert icon* for the list) and blank lines. Personnel get a skills list,
  ships get staffing icons, missions get a quadrant letter, points, span and requirements.
- **Preview**: live render; *Download PNG* saves the single card. A badge warns when game text
  had to be shrunk to fit.

## Fonts

The originals use Crillee (titles) and Futura Condensed (text), which are commercial. The app
bundles open lookalikes (Exo 2 and Fira Sans Condensed). If you own the originals, use **Fonts…**
to load your `.ttf`/`.otf` files; they are kept in the browser only.

## Known limitations

- Some elements are baked into the source frames and come along with the frame you pick: the
  affiliation icon, the era/icon strip on personnel, and the affiliation icons at the bottom of
  missions. Choose a frame whose baked icons suit your card (the picker shows the source card).
- Older (non-HiRes) sets had their skill bullets painted into the frame; the extractor erases them.
- Art is placed with "cover" semantics into a fixed rectangle per card type.

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
