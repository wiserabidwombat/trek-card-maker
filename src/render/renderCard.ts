import type { Catalog, Frame, Template, TextBox } from '../catalog/types';
import { artBoxFor } from '../catalog/types';
import { ATTRIBUTE_FIELDS, DEFAULT_ART_FILL, QUADRANTS, displayTitle, maxIcons, staffingIcons, typeBarText, type Card } from '../model/card';
import { parseMarkup, type Run } from '../model/markup';
import { skillText } from '../model/skills';
import { missionIconPositions, slotPlacement } from './iconLayout';
import type { AssetCache } from './assets';
import { cssFont, cssFontForStyle, specForRole, specForStyle, type FontConfig } from './fonts';
import type { TextOp, TextSpec } from './textOps';
import { boxToPx, cardBorderPx, cropDraw, ptToPx, type PxRect } from './geometry';
import { SCREEN_PROFILE, profiledPt, sharpenPixels, type RenderProfile } from './printProfile';
import { INK_BLACK, inkColour } from './ink';
import { fitFlow, layoutRuns, MIN_BODY_PT, type Measure, type PlacedLine, type Style } from './textLayout';
import { typeset } from './typography';

export interface RenderContext {
  catalog: Catalog;
  frame: Frame;
  template: Template;
  fonts: FontConfig;
  assets: AssetCache;
  userImage?: HTMLImageElement;
  base: string; // URL prefix for catalog files, e.g. '/frames/'
  /** Printer-specific adjustments; the screen preview uses the laser (neutral) profile. */
  profile?: RenderProfile;
  /** When given, text is recorded here (card-pixel coordinates) instead of painted on the canvas. */
  textSink?: TextOp[];
  /** Fill the card's corners black instead of leaving them white outside the rounding: for sheets printed with bleed. */
  squareCorners?: boolean;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** The game text does not fit even at MIN_BODY_PT and runs past its box. */
  overflow: boolean;
  /** Body text size used, in template points, and the template's own size (7 pt on every frame). */
  textPt: number;
  basePt: number;
  /** The recorded text when a sink was given, offset to the finished card's coordinates. */
  textOps?: TextOp[];
}

/**
 * Paint a run of text, or record it. `g.font` must already be set; the run is measured with it so
 * alignment resolves to a left edge that the PDF can reuse.
 */
function putText(
  g: CanvasRenderingContext2D,
  sink: TextOp[] | undefined,
  text: string,
  spec: TextSpec,
  sizePx: number,
  x: number,
  baseline: number,
  align: 'left' | 'center' | 'right',
  colour: string,
  rotate = 0,
): void {
  const width = g.measureText(text).width;
  const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  if (sink) {
    sink.push({ text, spec, sizePx, x: left, y: baseline, colour, ...(rotate ? { rotate } : {}) });
    return;
  }
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = colour;
  if (rotate) {
    // anticlockwise about the origin, so 90 runs the text up the card with the glyph tops facing left
    g.save();
    g.translate(left, baseline);
    g.rotate((-rotate * Math.PI) / 180);
    g.fillText(text, 0, 0);
    g.restore();
    return;
  }
  g.fillText(text, left, baseline);
}

/**
 * The small line that climbs the right edge beside the artwork, where the originals print their
 * legal notice ("NOT ENDORSED BY CBS OR PAR. PIC."). Capitals, shrunk to fit the run when long.
 */
function drawEdgeLine(
  g: CanvasRenderingContext2D,
  sink: TextOp[] | undefined,
  text: string,
  box: TextBox,
  rect: PxRect,
  sizePx: number,
  fonts: FontConfig,
): void {
  const t = text.toUpperCase();
  let px = sizePx;
  g.font = cssFont(box.font, px, fonts);
  let width = g.measureText(t).width;
  while (width > rect.h && px > sizePx * 0.6) {
    px *= 0.95;
    g.font = cssFont(box.font, px, fonts);
    width = g.measureText(t).width;
  }
  // the run starts at the bottom of the box; the baseline sits towards its outer (right) side
  putText(g, sink, t, specForRole(box.font, fonts), px, rect.x + rect.w * BASELINE_RATIO, rect.y + rect.h, 'left', inkColour(box.colour), 90);
}

/** Baseline that centres `text` vertically on `cy` with the current font. */
function middleBaseline(g: CanvasRenderingContext2D, text: string, cy: number): number {
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent || 0;
  const desc = m.actualBoundingBoxDescent || 0;
  return cy + (asc - desc) / 2;
}

// Pure black: many inkjet drivers print near-black as a mix of colour inks, which blurs small text.
const TEXT_COLOUR = INK_BLACK;
const SKILL_BULLET = 'skill-dot';
const BASELINE_RATIO = 0.78; // baseline position inside a text box, as a fraction of its height

type IconImage = HTMLImageElement | HTMLCanvasElement;

/** The high-resolution twin when the catalog has one, else the icon's own file. */
function iconFile(catalog: Catalog, id: string): string | undefined {
  const def = catalog.icons.find((i) => i.id === id);
  return def?.hi ?? def?.file;
}

function sharpened(img: HTMLImageElement): IconImage {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  if (!g || !c.width || !c.height) return img;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  data.data.set(sharpenPixels(data.data, c.width, c.height));
  g.putImageData(data, 0, 0);
  return c;
}

async function loadIcons(ctx: RenderContext, ids: Iterable<string>): Promise<Map<string, IconImage>> {
  const map = new Map<string, IconImage>();
  const sharpen = (ctx.profile ?? SCREEN_PROFILE).sharpenIcons;
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const file = iconFile(ctx.catalog, id);
      if (!file) return;
      try {
        const img = await ctx.assets.getImage(ctx.base + file);
        map.set(id, sharpen ? sharpened(img) : img);
      } catch {
        /* missing icon: skipped */
      }
    }),
  );
  return map;
}

function naturalSize(img: IconImage): { w: number; h: number } {
  return img instanceof HTMLCanvasElement ? { w: img.width, h: img.height } : { w: img.naturalWidth, h: img.naturalHeight };
}

function iconIds(runs: Run[]): string[] {
  return runs.flatMap((r) => (r.kind === 'icon' ? [r.id] : []));
}

function drawBoxText(
  g: CanvasRenderingContext2D,
  sink: TextOp[] | undefined,
  text: string,
  box: TextBox,
  rect: PxRect,
  sizePx: number,
  fonts: FontConfig,
  opts: { uppercase?: boolean; maxWidth?: number; align?: TextBox['align']; x?: number } = {},
): void {
  if (!text) return;
  const t = opts.uppercase ? text.toUpperCase() : text;
  let px = sizePx;
  const maxWidth = opts.maxWidth ?? rect.w;
  g.font = cssFont(box.font, px, fonts);
  let width = g.measureText(t).width;
  while (width > maxWidth && px > sizePx * 0.5) {
    px *= 0.95;
    g.font = cssFont(box.font, px, fonts);
    width = g.measureText(t).width;
  }
  const align = opts.align ?? box.align;
  const x = opts.x ?? (align === 'center' ? rect.x + rect.w / 2 : align === 'right' ? rect.x + rect.w : rect.x);
  putText(g, sink, t, specForRole(box.font, fonts), px, x, rect.y + rect.h * BASELINE_RATIO, align, inkColour(box.colour));
}

function drawPlacedLines(
  g: CanvasRenderingContext2D,
  sink: TextOp[] | undefined,
  lines: PlacedLine[],
  originX: number,
  originY: number,
  width: number,
  fonts: FontConfig,
  icons: Map<string, IconImage>,
  align: 'left' | 'center',
  colour: string = TEXT_COLOUR,
): void {
  for (const pl of lines) {
    const baseline = originY + pl.y + pl.lineHeightPx * 0.8;
    const offset = align === 'center' ? (width - pl.line.width) / 2 : 0;
    for (const piece of pl.line.pieces) {
      const x = originX + offset + piece.x;
      if (piece.icon !== undefined) {
        const img = icons.get(piece.icon);
        const size = piece.width;
        if (img) g.drawImage(img, x, baseline - size * 0.85, size, size);
        continue;
      }
      if (!piece.text) continue;
      g.font = cssFontForStyle(piece.style, pl.sizePx, fonts);
      putText(g, sink, piece.text, specForStyle(piece.style, fonts), pl.sizePx, x, baseline, 'left', colour);
    }
  }
}

export async function renderCard(card: Card, ctx: RenderContext): Promise<RenderResult> {
  const { frame, template: t } = ctx;
  const sink = ctx.textSink;
  const profile = ctx.profile ?? SCREEN_PROFILE;
  const fonts: FontConfig = profile.heavierText ? { ...ctx.fonts, heavier: true } : ctx.fonts;
  const W = frame.w;
  const H = frame.h;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D context unavailable');

  const frameImg = await ctx.assets.getImage(ctx.base + frame.file);
  g.drawImage(frameImg, 0, 0, W, H);

  // user artwork, clipped to the art box
  const art = artBoxFor(frame, t);
  const artRect = boxToPx({ x0: art[0], y0: art[1], x1: art[2], y1: art[3] }, W, H);
  if (ctx.userImage && card.image) {
    const m = cropDraw({ w: ctx.userImage.naturalWidth, h: ctx.userImage.naturalHeight }, card.image.crop, artRect);
    g.save();
    g.beginPath();
    g.rect(artRect.x, artRect.y, artRect.w, artRect.h);
    g.clip();
    // zoomed-out crops leave part of the art area empty: fill it with the card's chosen colour
    g.fillStyle = card.image.fill ?? DEFAULT_ART_FILL;
    g.fillRect(artRect.x, artRect.y, artRect.w, artRect.h);
    if (m) g.drawImage(ctx.userImage, m.sx, m.sy, m.sw, m.sh, m.dx, m.dy, m.dw, m.dh);
    g.restore();
    if (frame.overlay) {
      try {
        const overlay = await ctx.assets.getImage(ctx.base + frame.overlay);
        g.drawImage(overlay, 0, 0, W, H);
      } catch {
        /* overlay optional */
      }
    }
  }

  const px = (pt: number) => ptToPx(profiledPt(pt, profile), t.refWidthPt, W);
  const measure: Measure = (text, style, sizePx) => {
    g.font = cssFontForStyle(style, sizePx, fonts);
    return g.measureText(text).width;
  };

  // simple boxes
  const simple: Record<string, string> = {
    cost: card.fields.cost ?? '',
    title: typeset(displayTitle(card)),
    subtitle: typeset(card.fields.subtitle ?? ''),
    typeBar: typeset(typeBarText(card)),
    points: card.fields.points ?? '',
    span: card.fields.span ?? '',
    collector: card.fields.collectorInfo ?? '',
  };
  for (const [role, text] of Object.entries(simple)) {
    const box = t.boxes[role];
    if (!box || !text) continue;
    const rect = boxToPx(box, W, H);
    // title/subtitle may extend to the right edge of the frame's title bar
    const maxWidth = role === 'title' || role === 'subtitle' ? W * 0.95 - rect.x : rect.w;
    drawBoxText(g, sink, text, box, rect, px(box.sizePt), fonts, { maxWidth });
  }

  // the edge line up the right side (credit, legal notice)
  const credit = (card.fields.credit ?? '').trim();
  if (credit && t.boxes.legal) {
    drawEdgeLine(g, sink, credit, t.boxes.legal, boxToPx(t.boxes.legal, W, H), px(t.boxes.legal.sizePt), fonts);
  }

  // attributes: label left, value right-aligned within the box
  const attrFields = ATTRIBUTE_FIELDS[card.type];
  if (attrFields) {
    attrFields.forEach((fieldId, i) => {
      const box = t.boxes[`attr${i}`];
      if (!box) return;
      const rect = boxToPx(box, W, H);
      const label = fieldId.toUpperCase();
      const size = px(box.sizePt);
      drawBoxText(g, sink, label, box, rect, size, fonts, { align: 'left', maxWidth: rect.w * 0.75 });
      const value = card.fields[fieldId] ?? '';
      if (value) drawBoxText(g, sink, value, box, rect, size, fonts, { align: 'right' });
    });
  }

  // icons needed for flow + skills
  // typographic quotes and dashes first, then the inline markup
  const gameRuns = parseMarkup(typeset(card.fields.gameText ?? ''));
  const loreRuns = parseMarkup(typeset(card.fields.lore ?? ''));
  const reqRuns = parseMarkup(typeset(card.fields.requirements ?? ''));
  const staffing = card.type === 'ship' ? staffingIcons(card) : [];
  const listIcons = card.icons.slice(0, maxIcons(card.type, t));
  const icons = await loadIcons(ctx, [
    ...iconIds(gameRuns),
    ...iconIds(loreRuns),
    ...iconIds(reqRuns),
    SKILL_BULLET,
    ...staffing,
    ...listIcons,
  ]);

  // Other Icons in the socket column (personnel, ship): ring, then icon
  if ((card.type === 'personnel' || card.type === 'ship') && t.iconSlots && listIcons.length) {
    let ring: HTMLImageElement | null = null;
    if (frame.ring) {
      try {
        ring = await ctx.assets.getImage(ctx.base + frame.ring);
      } catch {
        /* ring optional */
      }
    }
    listIcons.forEach((id, i) => {
      const slot = t.iconSlots![i];
      if (!slot) return;
      const p = slotPlacement(slot, W, H);
      if (ring) g.drawImage(ring, p.ring.cx - p.ring.w / 2, p.ring.cy - p.ring.w / 2, p.ring.w, p.ring.w);
      const img = icons.get(id);
      if (img) g.drawImage(img, p.icon.cx - p.icon.w / 2, p.icon.cy - p.icon.w / 2, p.icon.w, p.icon.w);
    });
  }

  // headquarters missions carry a text label in the strip instead of affiliation icons
  const hqLabel = card.type === 'mission' ? typeset((card.fields.hqLabel ?? '').trim()) : '';
  if (hqLabel && t.missionAffiliations) {
    const strip = t.missionAffiliations;
    const titleBox = t.boxes.title;
    const size = px((titleBox?.sizePt ?? 8) * 1.05);
    g.font = cssFont('title', size, fonts);
    putText(g, sink, hqLabel, specForRole('title', fonts), size, W / 2, middleBaseline(g, hqLabel, strip.cy * H), 'center', '#ffffff');
  }

  // mission affiliation icons along the bottom strip, centred (a headquarters label takes their place)
  if (card.type === 'mission' && t.missionAffiliations && listIcons.length && !hqLabel) {
    const positions = missionIconPositions(listIcons.length, t.missionAffiliations, W, H);
    listIcons.forEach((id, i) => {
      const img = icons.get(id);
      if (!img) return;
      const p = positions[i];
      // fit the emblem into a p.w square: wide marks fill the width, tall ones the height
      const nat = naturalSize(img);
      const scale = p.w / Math.max(nat.w, nat.h);
      const w = nat.w * scale;
      const h = nat.h * scale;
      g.drawImage(img, p.cx - w / 2, p.cy - h / 2, w, h);
    });
  }

  // ship staffing icons over the artwork
  if (t.staffing && staffing.length) {
    const sl = t.staffing;
    const size = sl.size * W;
    staffing.slice(0, sl.max).forEach((id, i) => {
      const img = icons.get(id);
      if (!img) return;
      const cx = sl.cx * W;
      const cy = (sl.y0 + sl.step * i) * H;
      g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    });
  }

  // mission quadrant badge
  const quadrantCode = (card.fields.quadrant ?? '').toUpperCase();
  const quadrant = card.type === 'mission' ? QUADRANTS[quadrantCode] : undefined;
  if (t.quadrant && quadrant) {
    const q = t.quadrant;
    const cx = q.cx * W;
    const cy = q.cy * H;
    const r = q.r * W;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = quadrantFill(q, quadrantCode);
    g.fill();
    g.font = `normal 400 ${px(q.sizePt)}px ${fonts.title}`;
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(quadrant, cx, cy + r * 0.05);
    g.restore();
  }

  const flowSizePx = px(t.flow.sizePt);
  const lineHeightPx = t.flow.lineHeight * H;
  let flowTop = t.flow.y0 * H;

  // skills (personnel)
  if (card.type === 'personnel' && t.skills && card.skills.length) {
    const s = t.skills;
    const bullet = s.bulletSize * W;
    const gap = bullet * 0.55;
    const rowH = s.rowHeight * H;
    const x0 = s.x0 * W;
    const x1 = s.x1 * W;
    let x = x0;
    let y = s.y0 * H;
    const style: Style = { bold: true, italic: false };
    const skillColour = inkColour(s.colour);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    for (const skill of card.skills) {
      const text = skillText(skill);
      if (!text) continue;
      const w = measure(text, style, flowSizePx);
      const itemW = bullet + gap + w;
      if (x > x0 && x + itemW > x1) {
        x = x0;
        y += rowH;
      }
      const img = icons.get(SKILL_BULLET);
      const baseline = y + rowH * 0.8;
      if (img) g.drawImage(img, x, baseline - bullet * 0.95, bullet, bullet);
      g.font = cssFontForStyle(style, flowSizePx, fonts);
      putText(g, sink, text, specForStyle(style, fonts), flowSizePx, x + bullet + gap, baseline, 'left', skillColour);
      x += itemW + bullet * 1.2;
    }
    flowTop = Math.max(flowTop, y + rowH + rowH * 0.15);
  }

  // mission requirements (bold, centred, wrapped)
  if (card.type === 'mission' && t.requirements && reqRuns.length) {
    const r = t.requirements;
    const rect = boxToPx(r, W, H);
    const size = px(r.sizePt);
    const lines = layoutRuns(reqRuns, rect.w, size, measure, size * 1.1, { bold: true, italic: false });
    const placed: PlacedLine[] = lines.map((line, i) => ({
      block: 0,
      line,
      y: i * lineHeightPx,
      sizePx: size,
      lineHeightPx,
    }));
    drawPlacedLines(g, sink, placed, rect.x, rect.y, rect.w, fonts, icons, 'center', inkColour(r.colour));
    flowTop = Math.max(flowTop, rect.y + lines.length * lineHeightPx + lineHeightPx * 0.2);
  }

  // game text + lore flow
  const flowRect = boxToPx(t.flow, W, H);
  const flowHeight = Math.max(0, flowRect.y + flowRect.h - flowTop);
  const fit = fitFlow(
    [
      { runs: gameRuns, style: { bold: false, italic: false }, sizeScale: 1, gapBefore: 0 },
      { runs: loreRuns, style: { bold: false, italic: true, light: true }, sizeScale: t.lore.sizePt / t.flow.sizePt, gapBefore: 0.45 },
    ],
    flowRect.w,
    flowHeight,
    flowSizePx,
    lineHeightPx,
    measure,
    flowSizePx * 1.1,
    Math.min(1, MIN_BODY_PT / t.flow.sizePt),
  );
  drawPlacedLines(g, sink, fit.lines, flowRect.x, flowTop, flowRect.w, fonts, icons, 'left', inkColour(t.flow.colour));

  const card_ = withCardBorder(canvas, t, ctx.squareCorners ?? false);
  if (sink) {
    // recorded positions are frame pixels; the finished card has the border around the frame
    const { pad } = cardBorderPx(t, W);
    for (const op of sink) {
      op.x += pad;
      op.y += pad;
    }
  }
  return {
    canvas: card_,
    overflow: fit.overflow,
    textPt: +(t.flow.sizePt * fit.scale).toFixed(1),
    basePt: t.flow.sizePt,
    ...(sink ? { textOps: sink } : {}),
  };
}

/**
 * HiRes frames are the inner card only; the printed card is a black rounded rectangle with the
 * frame inset in it (as on the TrekCC sheets). White paper shows outside the rounded corners,
 * unless `square` asks for black corners (sheets with bleed, cut square and punched round later).
 */
function withCardBorder(frameCanvas: HTMLCanvasElement, t: Template, square = false): HTMLCanvasElement {
  const { pad, radius } = cardBorderPx(t, frameCanvas.width);
  if (!pad) return frameCanvas;
  const W = frameCanvas.width + 2 * pad;
  const H = frameCanvas.height + 2 * pad;
  const card = document.createElement('canvas');
  card.width = W;
  card.height = H;
  const g = card.getContext('2d');
  if (!g) return frameCanvas;
  g.fillStyle = square ? '#000000' : '#ffffff';
  g.fillRect(0, 0, W, H);
  if (!square) {
    g.fillStyle = '#000000';
    roundedRectPath(g, 0, 0, W, H, radius);
    g.fill();
  }
  g.drawImage(frameCanvas, pad, pad);
  g.strokeStyle = '#231f20';
  g.lineWidth = 1;
  g.strokeRect(pad - 0.5, pad - 0.5, frameCanvas.width + 1, frameCanvas.height + 1);
  return card;
}

/** A rounded-rectangle path built from arcs, so browsers without CanvasRenderingContext2D.roundRect (Safari < 16, Firefox < 112) get the same corners. */
export function roundedRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** The badge disc colour for a quadrant code: the colour measured from that quadrant's cards, else the template's one. */
export function quadrantFill(q: { fill: string; fills?: Record<string, string> }, code: string): string {
  return q.fills?.[code.toUpperCase()] ?? q.fill;
}
