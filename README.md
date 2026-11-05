# Trek Card Maker

A browser app for designing custom **Star Trek Customizable Card Game, Second Edition** cards.
Pick a clean base frame (one per card type and affiliation, built from The Continuing Committee's
free-to-print virtual card PDFs), add the rulebook's *Other Icons*, staffing, mission affiliations
and skills from lists, fill in the card text, drop in your own artwork (with crop, zoom and
rotate), and export a US Letter or A4 print sheet (3×3 cards at 63×88 mm, the TrekCC size, with cut
marks) as a PDF at the frames' native resolution.

Everything runs in your browser; nothing is uploaded. Cards and images are stored in the browser's
IndexedDB, so they stay on the machine and browser you made them in. Use **Export deck (JSON)**
regularly for a backup you can import elsewhere.

## Use it

Open **https://wiserabidwombat.github.io/trek-card-maker/** in a current Chrome, Edge, Firefox or
Safari. No install; the first visit shows a welcome panel with a **Load sample deck** button.

The hosted app works offline after the first visit (a service worker keeps the app and the frames
you have used), and browsers that support it offer an **Install** button in the top bar.

On a phone the four columns become one at a time, picked from a bar along the bottom (Cards, Frame,
Edit, Preview); ↑ / ↓ buttons reorder cards where there is no drag. Cropping works by touch, though a
desktop is still the comfortable place for artwork.

## Run it locally

Node.js 20+ is all you need; the frame catalog is included in the repository.

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

- **Cards** (left): the deck switcher (several named decks; **+** makes one, **✎** renames, *Delete
  deck…* removes it with its cards), your saved cards (drag the ⋮⋮ handle or press Alt+↑/↓ to
  reorder; a filter box appears once there are more than three), copy counts for the print sheet,
  PDF/JSON export and import. **Undo** / **Redo** in the top bar (Ctrl+Z / Ctrl+Shift+Z outside a
  text field) step through edits, new cards, deletions and reorders; a burst of typing is one step. *Export deck (JSON)* writes the current deck with its name; *Import deck
  (JSON)…* creates a new deck from the file and switches to it. *Export deck list (TXT)* writes a
  plain-text list the way players post them: missions, dilemma pile and draw deck by type, each card
  as "2x Title, Subtitle" with the section counts.
  A line under the buttons says when the deck was last exported and how many saves have happened
  since; after 20 it turns amber as a reminder that the browser holds the only copy.
- **Frame**: pick the card type, then the affiliation (or mission/dilemma type).
- **Checks** (top bar; the button counts the warnings) gathers every card's writing checks in one
  place, adds the ones that only show across cards (two cards with the same collector number or
  title, an edge line or collector info on some cards but not others, mixed set numbers), and
  offers two deck-wide tools: number every card in deck order from a set, rarity and first number,
  and set the edge line everywhere. Each is one undoable step.
- **Gallery** (top bar) shows every card in the deck as a picture, with copies and a note when text
  had to shrink; click one to edit it. Pictures render in the background and are kept until a card changes.
- **Import cards (CSV)…** adds a row per card to the current deck from a spreadsheet; Help's
  Spreadsheet tab lists the columns and offers a template. Artwork is added per card afterwards.
- **Artwork**: choose a PNG/JPEG/WebP, drop one onto the Artwork section, or paste one with
  Ctrl+V while the card is selected; then *Adjust crop* to position, zoom and rotate it. The crop
  box matches the frame's art area. The panel rates how the crop will print on a 63 mm card: nothing
  at 300 dpi or better, a note below that with the pixel width the crop needs, red under 200 dpi;
  the export dialog lists any such cards. Zoom out (or *Fit whole picture*) to get more of the picture
  in: the part of the art area the picture does not cover shows the **Fill** colour (black by
  default). A warning appears if the crop is smaller than the printed area.
- **Card text**: fields depend on the card type. Game text supports `**bold**`, `*italic*`,
  `{icon:klingon}` and blank lines; the toolbar above each text field (or Ctrl+B / Ctrl+I) wraps the
  selection, and straight quotes, spaced hyphens, `cost -2` and `...` print as “ ” – –2 … without changing
  what you typed. The **Keyword…** menu inserts a keyword the way the cards print it (`**Thief.**`,
  `**Commander: U.S.S. Defiant.**`), and **Checks** under the text points out wording that would give a
  custom card away: requirements not in bold, lowercase or misspelt skill names, `Cunning > 30` with
  spaces, a missing final period, unknown icon ids.
  - Personnel and ships: **Other icons** (command, staff, past, alternate, future, Deep Space
    Nine, Earth, Maquis, Terok Nor, The Next Generation, The Original Series, Voyager) go into
    the socket column in the order you pick them; the frame decides how many sockets there are.
  - Personnel: **Skills** from the 23 standard skills with a multiplier (prints as
    "2 Leadership"), or *Custom…* for a house skill.
  - Ships: staffing icons over the art. Missions: **Affiliations** (up to five, centred along the
    bottom), a quadrant letter, points, span and requirements. A **Headquarters label** (for
    example "Borg Headquarters") replaces the affiliation icons in the bottom strip, as on
    headquarters missions; leave points empty for those.
  - **Collector info** is set number, rarity and card number ("25 V 1"; V is a virtual card, VP a
    virtual promo), printed in the bottom bar as on the originals; a new card continues the set
    with the next number. The **Edge line** prints in small capitals up the right edge beside the
    art, where the real cards carry their legal notice; the suggested line is
    "FAN-MADE CARD · NOT FOR SALE".
- **Preview**: live render; *Download PNG* saves the single card. A badge warns when game text
  had to be shrunk to fit.
- **Export for Tabletop Simulator** saves the deck as card-sheet images for TTS's Custom Deck
  importer: a 10 × 7 grid per sheet (69 cards, copies included; longer decks get more sheets),
  kept within the 4096 px texture limit, plus an optional plain back with the deck name. The
  dialog lists the Width, Height and Number to enter for each sheet.
- **Card backs**: the export dialog can follow every sheet with a back page, mirrored left to
  right so a long-edge duplex print puts each back behind its front. Use the plain back (deck name)
  or your own picture, which is kept in the browser.
- **Bleed** (on by default in the export dialog): black runs 2 mm past every cut line on fronts
  and backs, so a cut that drifts leaves a black sliver rather than a white one. Cards on a bleed
  sheet print with square corners for a corner punch; the cut marks stay where they are.
- **Export print sheet** writes every piece of card text as real PDF text (fonts embedded and
  subset), so it prints at the printer's own resolution on any printer and the PDF is searchable;
  only the frame, art and icons are raster. A custom font loaded under **Fonts…** is embedded as
  is and used for every weight of its slot, so bold keywords stay regular unless the bundled fonts
  are used. The dialog asks for the paper (**US Letter** or **A4**; the same 3×3 grid is centred on either, so
  only the margins change) and whether the sheet is for a **laser** or an **inkjet** printer. Inkjets
  spread ink on the paper, so the inkjet profile uses heavier body text (Light → Regular,
  Regular → Medium), makes text under 7.5 pt about 5% larger, sharpens the icons and embeds the
  card rasters losslessly (a bigger file). Text is always pure black so the printer uses only the
  black cartridge. On either printer, use matte photo paper or coated card stock, set the driver to its
  Best or Photo quality, and print at 100%.

## Fonts

The originals use Crillee (titles) and Futura Condensed (text), which are commercial. The app
bundles open lookalikes (Exo 2 and Fira Sans Condensed). If you own the originals, use **Fonts…**
to load your `.ttf`/`.otf` files; they are kept in the browser only.

## Feedback

Something broken, or a frame or icon missing? [Open an issue](https://github.com/wiserabidwombat/trek-card-maker/issues/new/choose);
the templates ask for the few details that make a report actionable. The Help dialog and the
welcome panel link there too.

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

## Rebuilding the frame catalog (optional)

Only needed to change how frames, icons or templates are extracted. Requirements: Python 3.11+
with `pip install -r tools/requirements.txt` (PyMuPDF, Pillow, NumPy, pytest), the TrekCC
virtual-set PDFs (the "HiRes" versions give the sharpest frames; flat-scan sets such as *Timeless*
and *Finding Our Way* have no separate card images and are skipped) and the 2E rulebook PDF.

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
  mission strip; `icons/hi-*.png` 96 px versions of the inline icons (ring plus emblem), used in
  game text and staffing in place of the small `icons/*.png` originals wherever one exists
- `public/frames/overlays/*.png` the frame edges that overlap the art area, drawn back on top of your image
- `public/frames/catalog.json` the base frames, one layout template per card type and family
  (text boxes from the PDFs' own text layer, socket slots and strip geometry measured from the
  frames), the icon list with groups, and the skill vocabulary

The finished catalog (`base/`, `icons/`, `overlays/`, `rings/`, `catalog.json`) is committed so a clone
runs without the PDFs; the per-set source frames, review sheets and `source_frames.json` are
git-ignored. `--pass3-only` rebuilds the base frames and icons from `source_frames.json` in about a
minute (it needs a full run first). Hand corrections to a template go in
`tools/template_overrides.json`; inline icon names in `tools/icon_names.json`; rulebook label →
icon id in `tools/rulebook_icons.json`; affiliation colour centres in `tools/affiliation.py`.

## Development

```bash
npm test            # vitest unit tests (model, markup, layout, catalog, export, store)
npm run test:offline -- http://localhost:4173/ firefox   # after `npm run build && npm run preview`: worker caches, offline reload
npm run typecheck
npm run build
cd tools && python -I -X utf8 -m pytest -q   # extractor unit tests
```

Cross-browser smoke test (Playwright drives real Firefox and WebKit engines through the welcome
panel, sample deck, typing, paste, drag reorder, undo, PDF/JSON export and a reload; engines are
downloaded once):

```bash
npx playwright install firefox webkit
npm run test:browsers -- http://localhost:5173/ firefox webkit
```

Design notes live in `docs/superpowers/specs/` and the implementation plan in `docs/superpowers/plans/`.

The GitHub Actions workflow in `.github/workflows/ci.yml` runs the same checks on every push and
pull request, and on `master` builds the site with `BASE_PATH=/trek-card-maker/` and deploys it to
GitHub Pages. To host your own copy, enable Pages (source: GitHub Actions) on your fork.

## Credits and fair use

- Card frames, icons and layout templates are derived from [The Continuing Committee](https://www.trekcc.org)'s
  virtual expansions, distributed for non-commercial print-and-play use. Thank you to everyone
  there who designs, templates and releases those sets.
- Star Trek and related marks are trademarks of CBS Studios Inc. / Paramount Global. This is an
  unofficial fan tool for personal, non-commercial custom cards and is not affiliated with or
  endorsed by The Continuing Committee, Decipher, CBS or Paramount.
- Fonts: [Exo 2](https://fonts.google.com/specimen/Exo+2) and
  [Fira Sans Condensed](https://fonts.google.com/specimen/Fira+Sans+Condensed) (SIL Open Font License).

## License

The application code is released under the [MIT License](LICENSE). The frame catalog in
`public/frames/` is not; see the note at the end of that file.
