# Star Trek 2E Card Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Vite/React app that builds custom Star Trek CCG 2E cards from frames extracted out of the TrekCC PDFs, with image cropping and a Letter 3×3 print-sheet PDF export.

**Architecture:** A one-shot Python extractor turns the PDFs into `public/frames/` (frame JPEGs, art-edge overlays, icons, `catalog.json` with per-type layout templates). The browser app loads the catalog, edits cards, renders with a pure canvas renderer that reads geometry only from the catalog, persists to IndexedDB, and exports PDF with pdf-lib.

**Tech Stack:** Python 3.13 + PyMuPDF + Pillow + NumPy (extractor, pytest); Node 20, Vite 5, React 19, TypeScript strict, Vitest 5 (jsdom), pdf-lib, react-easy-crop, idb-keyval, @fontsource/exo-2, @fontsource/fira-sans-condensed.

**Spec:** `docs/superpowers/specs/2026-11-02-card-maker-design.md`

## Global Constraints

- Project root `C:\Users\altil\agent-workspace\trek-card-maker`; all paths below are relative to it.
- Source PDFs: `C:\Users\altil\Downloads\TrekCC\*.pdf`. Never commit them or anything under `public/frames/` (git-ignored, derived).
- Python is run as `python -I -X utf8 tools/extract_frames.py ...` (PDFs are untrusted inputs; `-I` isolates `sys.path`).
- Card families: `hires` = image 1021–1022 × 1464–1465; `std` = 744 × 1039. Flat-scan PDFs (2550×3300 page images) are skipped.
- Coordinates in the catalog are **fractions of the frame image** (0–1). Font sizes are **PDF points** with the family's `refWidthPt` (card width on the page in pt) so `px = sizePt / refWidthPt * frameWidthPx`.
- Print sheet: US Letter 612×792 pt, 3×3 cards of 180×252 pt, margins 36 pt (x) and 18 pt (y), cut marks in margins.
- Rendering order per card: frame → user image clipped to art box → art-edge overlay → text and icons.
- Every TS module in `src/model`, `src/render/textLayout.ts`, `src/export/sheetLayout.ts`, `src/store/deckJson.ts`, `src/catalog/loader.ts` is pure (no DOM) and unit-tested.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File structure

```
tools/
  extract_frames.py        CLI + orchestration (PDF walk, outputs)
  cardsort.py              pure helpers: classify_type, family_for, line_roles, derive_template
  artmask.py               per-group pixel-variance art box + overlay mask
  affiliation.py           colour sampling + cluster→name table
  icon_names.json          md5-prefix → icon id
  template_overrides.json  manual box corrections (type.family → partial template)
  requirements.txt
  tests/test_cardsort.py, tests/test_artmask.py, tests/test_affiliation.py
public/frames/             generated (catalog.json, <set>/NNN.jpg, <set>/thumbs/NNN.jpg,
                           overlays/<type>.<family>.png, icons/<id>.png, review/*.png)
src/
  catalog/types.ts         Catalog, Frame, Template, TextBox, IconDef types
  catalog/loader.ts        validateCatalog(json): Catalog (throws CatalogError)
  catalog/useCatalog.ts    React hook: fetch /frames/catalog.json → {status, catalog, error}
  model/card.ts            Card, CardType, newCard(), FIELD_DEFS, typeBarText()
  model/markup.ts          parseMarkup(text): Run[]
  render/textLayout.ts     layoutRuns(runs, width, measure): Line[]; fitFlow()
  render/fonts.ts          FontConfig, defaultFonts(), ensureFontsLoaded(), cssFont()
  render/assets.ts         loadImage(url), AssetCache
  render/renderCard.ts     renderCard(card, ctx): RenderResult
  editor/App.tsx           layout shell, state wiring
  editor/SetupScreen.tsx   shown when catalog missing
  editor/FramePicker.tsx   filters + thumbnail grid
  editor/FieldsForm.tsx    generated inputs per FIELD_DEFS
  editor/SkillsEditor.tsx  personnel skills list
  editor/ImageSection.tsx  choose file + crop button + quality warning
  editor/CropDialog.tsx    react-easy-crop modal
  editor/Preview.tsx       live canvas + overflow badge + PNG download
  editor/DeckList.tsx      saved cards, copy counts, export buttons
  editor/FontSettings.tsx  user TTF upload
  store/db.ts              idb-keyval wrappers
  store/deckJson.ts        serializeDeck/parseDeck (pure)
  export/sheetLayout.ts    layoutSheet(n): Page[]; cutMarks(): Line[]
  export/exportPdf.ts      buildSheetPdf(cards, renderer): Uint8Array
  main.tsx, index.css
```

---

### Task 1: Scaffold the Vite + React + TypeScript app with Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/editor/App.tsx`, `src/index.css`, `src/setupTests.ts`, `src/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test` (vitest run), `npm run build`, `npm run typecheck`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "trek-card-maker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fontsource/exo-2": "^5.2.0",
    "@fontsource/fira-sans-condensed": "^5.2.0",
    "idb-keyval": "^6.2.1",
    "pdf-lib": "^1.17.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-easy-crop": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write vite.config.ts, tsconfig files, index.html, main.tsx, App.tsx**

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['src/setupTests.ts'], globals: false },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"], "module": "ESNext",
    "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true, "isolatedModules": true, "resolveJsonModule": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`index.html`: standard Vite shell with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx">`, `<title>Trek Card Maker</title>`.

`src/main.tsx`: createRoot → `<App />`, imports `./index.css`, `@fontsource/exo-2/700-italic.css`, `@fontsource/fira-sans-condensed/300.css`, `300-italic.css`, `400.css`, `400-italic.css`, `700.css`, `700-italic.css`.

`src/editor/App.tsx`: `export default function App() { return <h1>Trek Card Maker</h1>; }`

`src/setupTests.ts`: `import '@testing-library/jest-dom/vitest';`

- [ ] **Step 3: Write smoke test**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('toolchain', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 4: Install and run**

Run: `npm install` then `npm test` → PASS 1 test; `npm run typecheck` → no errors.

- [ ] **Step 5: Commit** — `chore: scaffold vite react app with vitest`

---

### Task 2: Extractor pure helpers (`tools/cardsort.py`)

**Files:**
- Create: `tools/requirements.txt` (`pymupdf>=1.24`, `pillow>=10`, `numpy>=1.26`, `pytest>=8`), `tools/cardsort.py`, `tools/tests/test_cardsort.py`

**Interfaces:**
- Produces:
  - `family_for(w:int,h:int) -> str|None` ('hires'|'std'|None)
  - `classify_type(lines: list[Line]) -> str` where `Line = (box, text, font, size)` and box is a normalized `(x0,y0,x1,y1)` tuple.
  - `line_roles(ctype:str, lines) -> list[tuple[str, Line]]` roles ∈ {cost,title,subtitle,typeBar,points,span,collector,legal,attr,requirement,skill,body}
  - `derive_template(ctype, family, cards: list[list[(role, Line)]], ref_width_pt) -> dict` (template JSON described below)
  - `median_box(boxes) -> list[float]`

- [ ] **Step 1: Write failing tests**

```python
# tools/tests/test_cardsort.py
from cardsort import family_for, classify_type, line_roles, derive_template, median_box

CRIL='Crillee'; FB='Futura-CondensedBold'; F='Futura-Condensed'; FL='Futura-CondensedLightObl'; SC='Futura-CondensedBold-SC7'
def L(x0,y0,x1,y1,t,font=F,size=7.0): return ((x0,y0,x1,y1),t,font,size)

def test_family():
    assert family_for(1022,1464)=='hires' and family_for(1021,1465)=='hires'
    assert family_for(744,1039)=='std' and family_for(2550,3300) is None

def test_classify_type_by_typebar_word():
    assert classify_type([L(.41,.53,.57,.57,'Dilemma',FB,8)])=='dilemma'
    assert classify_type([L(.41,.53,.57,.57,'Interrupt',FB,8)])=='interrupt'

def test_classify_personnel_ship_mission():
    assert classify_type([L(.14,.91,.32,.94,'Integrity 3',SC,6.8)])=='personnel'
    assert classify_type([L(.14,.91,.24,.94,'Range',SC,6.8)])=='ship'
    assert classify_type([L(.89,.54,.98,.61,'35',CRIL,14.5), L(.48,.94,.51,.99,'3',CRIL,10)])=='mission'

def test_line_roles_dilemma():
    lines=[L(.171,.023,.197,.065,'2',CRIL,8), L(.241,.038,.575,.079,'Cutting Remark',CRIL,7.8),
           L(.418,.532,.569,.575,'Dilemma',FB,8), L(.136,.656,.927,.694,'Randomly select',F,7),
           L(.957,.703,.981,.871,'NOT ENDORSED',F,3.3), L(.153,.759,.59,.793,'"quote"',FL,6.5),
           L(.874,.976,.936,.998,'49 V 1',FB,4)]
    roles=dict((r,l[1]) for r,l in line_roles('dilemma',lines))
    assert roles['cost']=='2' and roles['title']=='Cutting Remark' and roles['typeBar']=='Dilemma'
    assert roles['collector']=='49 V 1' and roles['legal']=='NOT ENDORSED'
    bodies=[l[1] for r,l in line_roles('dilemma',lines) if r=='body']
    assert bodies==['Randomly select','"quote"']

def test_line_roles_personnel_skills_vs_body():
    lines=[L(.24,.02,.55,.064,'•Winn Adami',CRIL,8.5), L(.171,.025,.197,.066,'3',CRIL,8),
           L(.24,.061,.58,.094,'Uneasy Shepherd',CRIL,6.5), L(.427,.529,.56,.573,'Bajoran',FB,8),
           L(.187,.627,.386,.665,'Archaeology',FB,7), L(.43,.627,.597,.665,'Diplomacy',FB,7),
           L(.187,.659,.362,.697,'Leadership',FB,7), L(.144,.70,.905,.738,'Kai. When you play',FB,7),
           L(.144,.733,.909,.769,'cards in your discard',F,7), L(.142,.907,.32,.944,'Integrity 3',SC,6.8),
           L(.45,.907,.632,.944,'Cunning 6',SC,6.8), L(.763,.907,.934,.944,'Strength 4',SC,6.8)]
    rl=line_roles('personnel',lines)
    assert [l[1] for r,l in rl if r=='skill']==['Archaeology','Diplomacy','Leadership']
    assert [l[1] for r,l in rl if r=='body'][0]=='Kai. When you play'
    assert [l[1] for r,l in rl if r=='attr']==['Integrity 3','Cunning 6','Strength 4']
    assert dict((r,l[1]) for r,l in rl)['subtitle']=='Uneasy Shepherd'

def test_line_roles_mission():
    lines=[L(.197,.021,.513,.061,'•Gorlan Sector',CRIL,7.8), L(.197,.06,.577,.095,'Crush',CRIL,6.5),
           L(.891,.539,.985,.614,'35',CRIL,14.5), L(.179,.595,.829,.633,'Leadership, Navigation',FB,7),
           L(.265,.627,.733,.665,'2 Treachery, and Strength>36',FB,7), L(.066,.671,.895,.709,'Mirror. When',FB,7),
           L(.066,.703,.84,.74,'destroy your',F,7), L(.481,.938,.513,.99,'3',CRIL,10)]
    rl=dict()
    for r,l in line_roles('mission',lines): rl.setdefault(r,[]).append(l[1])
    assert rl['points']==['35'] and rl['span']==['3']
    assert rl['requirement']==['Leadership, Navigation','2 Treachery, and Strength>36']
    assert rl['body']==['Mirror. When','destroy your']

def test_median_box():
    assert median_box([(0,0,1,1),(0.2,0.2,0.8,0.8),(0.1,0.1,0.9,0.9)])==[0.1,0.1,0.9,0.9]

def test_derive_template_dilemma():
    card=[('cost',L(.171,.023,.197,.065,'2',CRIL,8)),('title',L(.241,.038,.575,.079,'T',CRIL,7.8)),
          ('typeBar',L(.418,.532,.569,.575,'Dilemma',FB,8)),('body',L(.136,.656,.927,.694,'a',F,7)),
          ('body',L(.136,.688,.909,.726,'b',F,7)),('body',L(.153,.759,.59,.793,'c',FL,6.5)),
          ('collector',L(.874,.976,.936,.998,'49 V 1',FB,4))]
    t=derive_template('dilemma','hires',[card,card],163.5)
    assert t['refWidthPt']==163.5
    assert t['boxes']['title']['sizePt']==7.8 and t['boxes']['title']['font']=='title'
    assert t['boxes']['cost']['align']=='center'
    assert abs(t['flow']['y0']-.656)<1e-6 and abs(t['flow']['lineHeight']-.032)<1e-6
    assert t['flow']['x0']==.136 and t['flow']['y1']==.95
    assert t['flow']['sizePt']==7 and t['lore']['sizePt']==6.5
```

- [ ] **Step 2: Run** `cd tools && python -I -X utf8 -m pytest -q` → FAIL (ImportError).

- [ ] **Step 3: Implement `tools/cardsort.py`**

Rules (all y/x are normalized box coords; `is_title_font = 'Crillee' in font`):
- `family_for`: hires if 1015≤w≤1023 and 1462≤h≤1466; std if w==744 and h==1039; else None.
- `classify_type`: if any text in {'Dilemma','Event','Interrupt','Equipment'} with y0 in [0.45,0.62] → that lowercased; elif any text startswith Integrity/Cunning/Strength → personnel; elif startswith Range/Weapons/Shields → ship; else mission.
- `line_roles(ctype, lines)`, in reading order (sort by y0 then x0):
  - `legal`: x0 > 0.94 and size < 4.5 (the vertical disclaimer)
  - `collector`: y0 > 0.95 and size ≤ 4.5
  - `cost`: title font, y0 < 0.08, x0 < 0.21, text is digits
  - `points` (mission): title font, size ≥ 12
  - `span` (mission): title font, y0 > 0.9
  - `title`: title font, y0 < 0.05 (or <0.08 if no subtitle candidate), size ≥ 7.5; `subtitle`: title font, size < 7.5, y0 < 0.12
  - `attr`: y0 > 0.88 and (SC font or text starts with an attribute word)
  - `typeBar`: not title font, 0.5 ≤ y0 ≤ 0.6 and ctype != 'mission'
  - personnel: lines after typeBar with y0 < first line whose x0 ≤ 0.15 → `skill`; remaining non-attr → `body`
  - mission: lines with y0 < first line whose x0 < 0.1 and y0 > 0.5 → `requirement`; remaining → `body`
  - everything else → `body`
- `median_box(boxes)` → element-wise `statistics.median`, rounded to 4 dp.
- `derive_template(ctype, family, cards, ref_width_pt)` returns:

```python
{
 'type': ctype, 'family': family, 'refWidthPt': ref_width_pt,
 'artBox': None,                      # filled by artmask step
 'boxes': { role: {'x0','y0','x1','y1','font','sizePt','align'} for role in cost,title,subtitle,typeBar,points,span,collector, and per-attr boxes 'attr0','attr1','attr2' (sorted by x0) },
 'flow': {'x0','y0','x1','y1','sizePt','lineHeight'},   # body text box: x0=min body x0 (median per card), y0=median first body y0, x1=0.93 (median of max x1 ≥) , y1 = attr y0 - 0.01 if attrs else 0.95, lineHeight = median Δy0 of consecutive body lines, sizePt = most common body size
 'lore': {'sizePt': most common size of light-oblique body lines, default flow size - 0.5},
 'skills': {'x0','y0','x1','rowHeight','bulletSize'} or None,  # personnel: x0 = median min skill x0 - bullet gap (0.043), y0 = median first skill y0, rowHeight like lineHeight, bulletSize 0.026
 'requirements': {'x0','y0','x1','y1','sizePt'} or None       # mission
}
```
  Font mapping: Crillee→`title`; name contains 'Bold' and 'SC'→`bodyBoldSC`; 'Bold' and ('Obl' or 'Italic')→`bodyBoldItalic`; 'Bold'→`bodyBold`; 'Light' and ('Obl' or 'Italic')→`bodyLightItalic`; 'Obl'/'Italic'→`bodyItalic`; else `body`. Align: cost/points/span/typeBar → center, others left.

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `feat(tools): card classification and template derivation helpers`

---

### Task 3: Art box and edge overlay from pixel variance (`tools/artmask.py`)

**Files:**
- Create: `tools/artmask.py`, `tools/tests/test_artmask.py`

**Interfaces:**
- Produces: `compute_art_mask(frames: list[np.ndarray HxWx3 uint8], threshold=14) -> (bbox: tuple[int,int,int,int], overlay: np.ndarray HxWx4)`; `bbox` is pixel (x0,y0,x1,y1) of the varying region in the top 60% of the card; `overlay` is RGBA where frame pixels inside the bbox keep the median colour with alpha 255 and art pixels are alpha 0 (outside bbox alpha 0).

- [ ] **Step 1: Failing test**

```python
import numpy as np
from artmask import compute_art_mask
def test_art_box_and_overlay():
    H,W=200,140
    frames=[]
    for seed in range(4):
        rng=np.random.default_rng(seed)
        f=np.full((H,W,3),90,np.uint8)        # constant frame
        f[20:100,10:130]=rng.integers(0,255,(80,120,3),np.uint8)   # art varies
        f[60:70,60:80]=200                      # constant "frame bar" inside art
        frames.append(f)
    bbox,overlay=compute_art_mask(frames)
    assert bbox==(10,20,130,100)
    assert overlay.shape==(H,W,4)
    assert overlay[65,70,3]==255 and tuple(overlay[65,70,:3])==(200,200,200)
    assert overlay[30,30,3]==0 and overlay[5,5,3]==0
```

- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Implement**: stack → `std = frames.std(axis=0).max(axis=2)`; `varying = std > threshold`; restrict to rows < 0.6H; bbox = bounding rect of varying pixels after removing isolated specks (`varying` eroded by a 3×3 majority filter using `scipy`-free numpy: count neighbours via shifted sums, keep where ≥5 of 9); overlay: median frame RGB, alpha = 255 where `~varying` inside bbox else 0; apply the same majority filter on alpha mask to drop JPEG noise.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(tools): art box detection and edge overlay`

---

### Task 4: Affiliation colour mapping (`tools/affiliation.py`)

**Files:** `tools/affiliation.py`, `tools/tests/test_affiliation.py`

**Interfaces:**
- Produces: `sample_colour(img: np.ndarray, family: str) -> tuple[int,int,int]` (mean RGB of the title-bar strip x 0.30–0.90, y 0.03–0.06 for both families); `nearest_affiliation(rgb, table) -> str`; `AFFILIATION_TABLE: dict[str, tuple[int,int,int]]` filled in Task 5 review; `cluster_colours(samples: list[rgb], k_max=14, tol=28) -> list[(centre, members)]` greedy clustering by Euclidean distance.

- [ ] **Step 1: Failing tests**
```python
from affiliation import nearest_affiliation, cluster_colours, sample_colour
import numpy as np
def test_nearest():
    t={'klingon':(150,40,40),'federation':(40,80,160)}
    assert nearest_affiliation((140,50,45),t)=='klingon'
def test_cluster():
    cs=cluster_colours([(0,0,0),(5,5,5),(200,200,200),(195,205,200)],tol=28)
    assert len(cs)==2 and sorted(len(m) for _,m in cs)==[2,2]
def test_sample_region():
    img=np.zeros((100,100,3),np.uint8); img[3:6,30:90]=(10,20,30)
    assert sample_colour(img,'hires')==(10,20,30)
```
- [ ] **Step 2–4:** implement, run, PASS. **Step 5: Commit** — `feat(tools): affiliation colour sampling`

---

### Task 5: Extractor CLI and first real run (`tools/extract_frames.py`)

**Files:** `tools/extract_frames.py`, `tools/icon_names.json` (start `{}`), `tools/template_overrides.json` (start `{}`)

**Interfaces:**
- CLI: `python -I -X utf8 tools/extract_frames.py --pdf-dir "C:/Users/altil/Downloads/TrekCC" --out public/frames [--review] [--limit N]`
- Output: `catalog.json` matching `src/catalog/types.ts` (Task 6).

- [ ] **Step 1: Implement orchestration**
  1. For each PDF (sorted), each page: collect lines `(normalized later)`, for each image xref with width ≥ 400 and `family_for` ≠ None, for each placement rect: lines inside rect → normalize boxes relative to rect → `classify_type` → `line_roles`. Skip xrefs already emitted. Record `refWidthPt = rect.width` per family (median).
  2. Pixmap → RGB (CMYK via `pymupdf.Pixmap(pymupdf.csRGB, pix)`) → numpy. Save `<set>/NNN.jpg` (q92) and `<set>/thumbs/NNN.jpg` (height 240). Keep per-(type,family) arrays for the art mask (cap 40 frames per group, downsample none).
  3. Personnel/ship: `sample_colour` → cluster; with `--review` write `review/aff_<k>.png` contact sheets (16 thumbs each, labelled with set/title and mean RGB) and `review/affiliation_clusters.json`; affiliation = `nearest_affiliation` against `AFFILIATION_TABLE` if table non-empty else `cluster-<k>`.
  4. Small images (8–40 px): dedupe by md5 of RGBA samples; id from `icon_names.json` (md5[:8] → name) else `icon-<md5[:8]>`; save `icons/<id>.png`; `--review` writes `review/icons.png` labelled with md5 prefixes.
  5. Per (type,family): `derive_template` over the collected role lists; `compute_art_mask` on the group frames → `artBox` (fractions) and `overlays/<type>.<family>.png`; apply `template_overrides.json` deep-merge; `--review` writes `review/template_<type>.<family>.png` = first frame with every box drawn in red, flow box green, art box blue, skills origin yellow.
  6. Write `catalog.json`: `{generatedAt, families:{hires:{refWidthPt}, std:{...}}, templates:{"<type>.<family>": T}, icons:[{id,file,w,h}], frames:[{id:"<Set>-NNN", set, type, family, affiliation, sourceTitle, w, h, file, thumb, overlay}]}`. Log skipped PDFs with reason.
- [ ] **Step 2: Run on the real folder with `--review --limit 2`** (fast), open `review/template_*.png` and `review/icons.png`, fix role heuristics if boxes land wrong.
- [ ] **Step 3: Full run with `--review`.** Review `review/aff_*.png`; fill `AFFILIATION_TABLE` with cluster centres → names (bajoran, borg, cardassian, dominion, federation, ferengi, klingon, romulan, starfleet, non-aligned, plus any extra such as maquis/terok-nor/mirror/vulcan/species-8472 as observed). Fill `icon_names.json` for recognisable icons (command, staff, skill-dot, each affiliation, past/alternate/future, earth, ds9, maquis, terok-nor, tng, tos, voy, headquarters, planet, space, dual). Re-run; confirm `affiliation` never contains `cluster-`.
- [ ] **Step 4: Verify counts**: ≥ 500 frames, all seven types present, every template has artBox and flow; `python -I -X utf8 -c` snippet printing per-type counts.
- [ ] **Step 5: Commit** — `feat(tools): PDF frame extractor producing catalog.json` (commit tools/*.json too; not public/frames).

---

### Task 6: Catalog types and loader

**Files:** `src/catalog/types.ts`, `src/catalog/loader.ts`, `src/catalog/loader.test.ts`, `src/catalog/useCatalog.ts`

**Interfaces:**
```ts
export type CardType = 'personnel'|'ship'|'equipment'|'event'|'interrupt'|'mission'|'dilemma';
export type Family = 'hires'|'std';
export type FontRole = 'title'|'body'|'bodyBold'|'bodyItalic'|'bodyBoldItalic'|'bodyLightItalic'|'bodyBoldSC';
export interface Box { x0:number; y0:number; x1:number; y1:number }
export interface TextBox extends Box { font: FontRole; sizePt: number; align: 'left'|'center'|'right' }
export interface Template { type: CardType; family: Family; refWidthPt: number; artBox: [number,number,number,number];
  boxes: Record<string, TextBox>; flow: Box & { sizePt:number; lineHeight:number };
  lore: { sizePt:number }; skills?: { x0:number; y0:number; x1:number; rowHeight:number; bulletSize:number } | null;
  requirements?: (Box & { sizePt:number }) | null }
export interface Frame { id:string; set:string; type:CardType; family:Family; affiliation:string; sourceTitle:string;
  w:number; h:number; file:string; thumb:string; overlay:string }
export interface IconDef { id:string; file:string; w:number; h:number }
export interface Catalog { generatedAt:string; templates: Record<string, Template>; icons: IconDef[]; frames: Frame[] }
export function templateFor(c: Catalog, f: Frame): Template   // key `${f.type}.${f.family}`
export class CatalogError extends Error {}
export function validateCatalog(json: unknown): Catalog   // throws CatalogError with a path message
```
`useCatalog()` returns `{ status:'loading'|'ready'|'missing'|'error', catalog?: Catalog, error?: string }`; fetches `/frames/catalog.json`; 404 → `missing`.

- [ ] **Step 1: Tests** (`loader.test.ts`): valid minimal catalog passes and `templateFor` finds `dilemma.hires`; missing `frames` → throws CatalogError mentioning `frames`; a frame whose template key is absent → throws mentioning the frame id.
- [ ] **Step 2–4:** implement, PASS, typecheck. **Step 5: Commit** — `feat(catalog): types, validation, loader hook`

---

### Task 7: Card model, field definitions, markup parser

**Files:** `src/model/card.ts`, `src/model/card.test.ts`, `src/model/markup.ts`, `src/model/markup.test.ts`

**Interfaces:**
```ts
export interface Skill { icon: string; text: string }
export interface CropRect { x:number; y:number; w:number; h:number }  // source pixels
export interface CardImage { blobKey: string; crop: CropRect; srcW:number; srcH:number }
export interface Card { id:string; name:string; type:CardType; frameId:string; fields:Record<string,string>;
  skills:Skill[]; image?: CardImage; copies:number; updatedAt:number }
export interface FieldDef { id:string; label:string; kind:'text'|'number'|'multiline'; placeholder?:string }
export const COMMON_FIELDS: FieldDef[]   // title, unique(checkbox handled as 'unique' text '1'/''), gameText(multiline), lore(multiline), collectorInfo
export const FIELD_DEFS: Record<CardType, FieldDef[]>  // per spec table (type-specific only)
export function newCard(type: CardType, frameId: string): Card
export function changeType(card: Card, type: CardType, frameId: string): Card   // keeps common fields, drops type-specific, clears skills unless personnel
export function typeBarText(card: Card): string   // dilemma/event/interrupt/equipment → capitalised type; personnel → fields.species; ship → fields.shipClass; mission → ''
export function displayTitle(card: Card): string  // '•' prefix when fields.unique === '1'
```
```ts
export type Run = { kind:'text'; text:string; bold:boolean; italic:boolean } | { kind:'icon'; id:string } | { kind:'break' };
export function parseMarkup(src: string): Run[]   // **bold**, *italic*, {icon:id}, '\n' → break; unmatched markers are literal
```
- [ ] **Step 1: Tests**: `parseMarkup('**Kai.** When *you* play {icon:bajoran} cards\nnext')` → 7 runs with the expected flags; unmatched `**` stays literal; `newCard('personnel','X').fields` has keys for every COMMON+personnel field as ''; `changeType` keeps `title` and drops `species`; `typeBarText` for each type.
- [ ] **Step 2–4:** implement with a small hand-written scanner (no regex backtracking); PASS. **Step 5: Commit** — `feat(model): card model, field defs, markup parser`

---

### Task 8: Text layout engine

**Files:** `src/render/textLayout.ts`, `src/render/textLayout.test.ts`

**Interfaces:**
```ts
export interface Style { bold:boolean; italic:boolean; light?:boolean }
export type Measure = (text: string, style: Style, sizePx: number) => number;
export interface Piece { x:number; text?:string; icon?:string; style:Style; width:number }
export interface Line { pieces: Piece[]; width:number }
export function layoutRuns(runs: Run[], maxWidth:number, sizePx:number, measure:Measure, iconWidth:number): Line[]
  // greedy word wrap; icons are inline boxes of iconWidth; 'break' forces a new line; collapses leading spaces on wrapped lines
export interface FlowBlock { runs: Run[]; style: Style; sizeScale: number; gapBefore: number }  // gameText (scale 1) then lore (lore size / flow size, gapBefore 0.6 lines)
export interface FitResult { sizePx:number; lines: { block:number; line:Line; y:number }[]; overflow:boolean }
export function fitFlow(blocks: FlowBlock[], width:number, height:number, basePx:number, lineHeightPx:number, measure:Measure, iconWidth:number, minScale=0.7, step=0.02): FitResult
  // lays out all blocks at basePx; if total height > height, reduce by `step` until fits or minScale; overflow=true if still too tall
```
- [ ] **Step 1: Tests** with `measure = (t,s,px) => t.length * px * 0.5 * (s.bold?1.1:1)`: wraps "aaaa bbbb cccc" at width for two words → 2 lines; break run splits lines; icon counts as iconWidth; `fitFlow` returns `overflow:false` when it fits, shrinks sizePx when 20 lines don't fit in 10 line heights, and `overflow:true` at minScale when still too tall.
- [ ] **Step 2–4:** implement, PASS. **Step 5: Commit** — `feat(render): run-based word wrap and flow fitting`

---

### Task 9: Fonts, assets, and the canvas renderer

**Files:** `src/render/fonts.ts`, `src/render/assets.ts`, `src/render/renderCard.ts`, `src/render/renderCard.test.ts` (pure helpers only)

**Interfaces:**
```ts
export interface FontConfig { title: string; body: string }   // CSS family names
export const DEFAULT_FONTS: FontConfig = { title: '"Exo 2"', body: '"Fira Sans Condensed"' }
export function cssFont(role: FontRole, sizePx: number, fonts: FontConfig): string
  // title → `italic 700 ${px}px ${fonts.title}`; body → `400`, bodyBold → `700`, bodyItalic → `italic 400`, bodyBoldItalic → `italic 700`, bodyLightItalic → `italic 300`, bodyBoldSC → `700` (renderer uppercases text)
export async function ensureFontsLoaded(fonts: FontConfig): Promise<void>  // document.fonts.load for each style
export async function registerUserFont(slot:'title'|'body', data: ArrayBuffer): Promise<string> // FontFace 'UserTitle'/'UserBody', returns family name

export class AssetCache { getImage(url:string): Promise<HTMLImageElement>; getBlobImage(key:string, blob:Blob): Promise<HTMLImageElement> }

export interface RenderContext { catalog: Catalog; frame: Frame; template: Template; fonts: FontConfig; assets: AssetCache; userImage?: HTMLImageElement; base: string /* '/frames/' */ }
export interface RenderResult { canvas: HTMLCanvasElement; overflow: boolean }
export async function renderCard(card: Card, ctx: RenderContext): Promise<RenderResult>
export function ptToPx(sizePt:number, refWidthPt:number, frameW:number): number
export function boxToPx(b: Box, w:number, h:number): {x:number;y:number;w:number;h:number}
export function coverDraw(src:{w:number;h:number}, crop: CropRect, dst:{x:number;y:number;w:number;h:number}): {sx,sy,sw,sh,dx,dy,dw,dh}  // scales crop to fill dst, centred
```
Renderer steps: size canvas to frame; draw frame image; if user image: `ctx.save(); clip(artBox); drawImage(cover…); restore()`; draw overlay image; for each template box with a value: set `cssFont`, `textBaseline='alphabetic'`, y = box.y1 - descent padding (use `box.y0 + 0.8*(box.y1-box.y0)`), align by box; colours: title/cost/subtitle/points/span `#111`, typeBar `#111`, body `#111`, collector `#111`; skills: iterate `card.skills`, place bullet icon (bulletSize*w) then text in bodyBold, wrap to next row when x exceeds `skills.x1`; flow: `fitFlow([{gameText runs, body}, {lore runs, light italic}])` then draw pieces; icons inside flow are drawn at `iconWidth = 1.1*sizePx`; attributes: `attr0..2` boxes draw `LABEL  value` from fields (personnel: integrity/cunning/strength; ship: range/weapons/shields) uppercased; mission: `requirements` box uses bodyBold wrapped centred; points/span centred.
- [ ] **Step 1: Tests** for `ptToPx(8,163.5,1022)≈50.0`, `boxToPx`, `coverDraw` (crop wider than box → sh trimmed and centred; exact aspect → identity mapping), `cssFont` strings.
- [ ] **Step 2–4:** implement; PASS; typecheck. **Step 5: Commit** — `feat(render): canvas card renderer with fonts and assets`

---

### Task 10: App shell, setup screen, frame picker, live preview

**Files:** `src/editor/App.tsx` (replace), `src/editor/SetupScreen.tsx`, `src/editor/FramePicker.tsx`, `src/editor/Preview.tsx`, `src/editor/useRenderer.ts`, `src/index.css`

**Interfaces:**
- `FramePicker({catalog, selectedId, onSelect(frame: Frame)})`: type tabs (7 types + All), affiliation select built from distinct `frame.affiliation` values for the chosen type, thumbnail grid (`<img loading="lazy" src={base+frame.thumb}>`), tooltip `${set} · ${sourceTitle}`.
- `Preview({card, ctx})`: holds a `<canvas>` sized to fit its column; `useRenderer(card, ctx)` debounces 60 ms, awaits `renderCard`, draws result scaled; shows "Text overflows — shortened to fit" badge when `overflow`; "Download PNG" button → `canvas.toBlob` → anchor download `${card.name||'card'}.png`.
- `App`: `useCatalog()`; `missing` → `SetupScreen` showing the exact extractor command; `ready` → state `{card, cards}`; selecting a frame of a different type calls `changeType`.
- [ ] **Step 1:** implement; CSS: three columns (picker 320px, form 1fr, preview 420px), dark neutral theme, grid of thumbs 100px wide.
- [ ] **Step 2: Manual check**: `npm run dev`, open in the built-in browser, pick a Klingon personnel frame → preview shows frame with art area intact and overlay edges correct.
- [ ] **Step 3: Commit** — `feat(editor): app shell, frame picker, live preview`

---

### Task 11: Fields form and skills editor

**Files:** `src/editor/FieldsForm.tsx`, `src/editor/SkillsEditor.tsx`

**Interfaces:** `FieldsForm({card, onChange(card)})` renders COMMON_FIELDS + FIELD_DEFS[type]; `unique` as a checkbox; multiline as textarea with a hint line "**bold**, *italic*, {icon:klingon}"; an icon picker button inserts `{icon:id}` at the cursor listing `catalog.icons` thumbnails. `SkillsEditor({skills, icons, onChange})`: rows with text input, up/down/remove, add button; bullet defaults to `skill-dot` if present in icons else first icon.
- [ ] **Step 1:** implement; **Step 2: manual**: type a title, cost, species, three skills, game text with a bold keyword and an icon, lore, attributes → preview matches the original layout proportions. **Step 3: Commit** — `feat(editor): fields form and skills editor`

---

### Task 12: Image selection and crop dialog

**Files:** `src/editor/ImageSection.tsx`, `src/editor/CropDialog.tsx`, `src/store/db.ts` (image blob part)

**Interfaces:**
- `db.ts`: `putImage(key: string, blob: Blob)`, `getImage(key): Promise<Blob|undefined>`, `deleteImage(key)`; keys `image:<uuid>` via `idb-keyval` `createStore('trek-card-maker','kv')`.
- `ImageSection({card, template, onChange})`: file input (accept png/jpeg/webp; reject others with a message); on pick: read into `Image` for `srcW/srcH`, store blob, set `card.image = {blobKey, crop: centred crop with art-box aspect, srcW, srcH}`; "Adjust crop" opens `CropDialog`; warning when `crop.w < artBoxPx.w` ("Image is smaller than the art area; it will be upscaled").
- `CropDialog({src: string (object URL), aspect, initial: CropRect, onDone(crop: CropRect), onCancel})`: `react-easy-crop` `Cropper` with `aspect`, zoom slider (1–4), rotation buttons (0/90/180/270 → stored in crop as `rotate`? No: rotation applied by re-encoding the blob on confirm so the renderer stays rotation-free), `onCropComplete(_, areaPixels)` → crop in source px.
- [ ] **Step 1:** implement; **Step 2: manual**: choose a photo, drag/zoom, confirm → preview shows it filling the art box without distortion; rotate 90 → confirm → still correct. **Step 3: Commit** — `feat(editor): image selection with crop dialog`

---

### Task 13: Persistence, deck list, JSON import/export

**Files:** `src/store/db.ts` (cards part), `src/store/deckJson.ts`, `src/store/deckJson.test.ts`, `src/editor/DeckList.tsx`, `src/editor/App.tsx` (wire)

**Interfaces:**
- `db.ts`: `listCards(): Promise<Card[]>`, `putCard(card)`, `deleteCard(id)`; `getUserFont(slot)`, `putUserFont(slot, blob)`.
- `deckJson.ts`: `serializeDeck(cards: Card[], images: Record<string,string /*base64 data URL*/>): string`; `parseDeck(json: string): {cards: Card[]; images: Record<string,string>}` throws `DeckFormatError` on bad shape; version field `1`.
- `DeckList({cards, currentId, onSelect, onNew, onDuplicate, onDelete, onCopiesChange, onExportJson, onImportJson, onExportPdf})`: rows with name, type, copies number input (0–9), total card count; buttons.
- App: autosave `putCard` 300 ms after change; load on start; "New card" uses current frame.
- [ ] **Step 1: Tests**: round-trip serialize→parse equals input; `parseDeck('{}')` throws; `parseDeck` of version 2 throws.
- [ ] **Step 2–3:** implement, PASS, manual: reload page keeps cards and images. **Step 4: Commit** — `feat(store): IndexedDB persistence, deck list, JSON import/export`

---

### Task 14: Sheet layout and PDF export

**Files:** `src/export/sheetLayout.ts`, `src/export/sheetLayout.test.ts`, `src/export/exportPdf.ts`

**Interfaces:**
```ts
export const LETTER = { w: 612, h: 792 }; export const CARD = { w: 180, h: 252 }; export const GRID = { cols: 3, rows: 3 };
export const MARGIN = { x: 36, y: 18 };
export interface Slot { page:number; x:number; y:number; w:number; h:number }  // PDF coords, y from bottom
export function layoutSheet(count: number): Slot[]          // row-major from top-left; page = floor(i/9)
export function cutMarks(): {x1:number;y1:number;x2:number;y2:number}[]  // 8 pt hairlines in each margin at every vertical/horizontal grid line (4 vertical lines × top+bottom, 4 horizontal × left+right = 16 lines)
export async function buildSheetPdf(items: {card: Card; ctx: RenderContext}[]): Promise<Uint8Array>
  // expands by card.copies, renders each distinct card once (JPEG q0.95 via canvas.toBlob), embeds once, draws at each slot, draws cut marks on every page
export function downloadBytes(bytes: Uint8Array, filename: string): void
```
- [ ] **Step 1: Tests**: `layoutSheet(1)[0]` = `{page:0, x:36, y:792-18-252=522, w:180, h:252}`; `layoutSheet(10)[9].page===1`; slot 4 x = 216; `cutMarks().length===16`; first vertical mark spans y 0→8 at x=36.
- [ ] **Step 2–3:** implement, PASS; manual: 2 cards with copies 5 and 6 → 2-page PDF, open in the browser pane; check with `python -I -X utf8 -c "import pymupdf;d=pymupdf.open('x.pdf');print(len(d), d[0].get_images())"` that embedded images are ≥ 744 px wide. **Step 4: Commit** — `feat(export): letter 3x3 sheet PDF with cut marks`

---

### Task 15: Font settings panel

**Files:** `src/editor/FontSettings.tsx`, wire into `App.tsx`

- `FontSettings({fonts, onChange(fonts: FontConfig)})`: two rows (Title font, Body font) each with current family name, "Load .ttf/.otf" input → `putUserFont(slot, blob)` + `registerUserFont` → `onChange`; "Reset" restores default. On app start, load stored user fonts before first render.
- [ ] **Step 1:** implement; **Step 2: manual** with any TTF on the machine (e.g. a Windows font copied to the scratchpad — do not commit it) → preview re-renders in that font. **Step 3: Commit** — `feat(editor): user font settings`

---

### Task 16: End-to-end verification and README

**Files:** `README.md`

- [ ] **Step 1:** `npm run typecheck && npm test && npm run build` all green; `cd tools && python -I -X utf8 -m pytest -q` green.
- [ ] **Step 2:** In the built-in browser: create one card of each of the seven types with an image, export the sheet, open the PDF; fix any layout mismatch via `tools/template_overrides.json` + re-run extractor.
- [ ] **Step 3:** README: prerequisites, extractor command, `npm run dev`, where cards are stored, font note, fair-use note about TrekCC frames.
- [ ] **Step 4: Commit** — `docs: README and verification notes`

## Self-review

- Spec coverage: extraction (T2–T5), catalog/templates (T5–T6), model+markup (T7), renderer with shrink-to-fit and overflow flag (T8–T9), picker/form/preview/PNG (T10–T11), crop dialog with zoom/rotate and quality warning (T12), persistence + JSON (T13), Letter sheet with cut marks and copy counts (T14), custom fonts (T15), error states: catalog missing (T10 SetupScreen), bad image type (T12), overflow badge (T10). Frame-load failure badge: handled in `useRenderer` (catch → `error` state shown in Preview) — add in T10.
- Types consistent: `Card.copies` used by T13 and T14; `CropRect` from T7 used in T9 `coverDraw` and T12; `RenderContext` from T9 used by T10/T14.
