import type { Catalog, Frame, Template, TextBox } from '../catalog/types';
import { artBoxFor } from '../catalog/types';
import { ATTRIBUTE_FIELDS, QUADRANTS, displayTitle, maxIcons, staffingIcons, typeBarText, type Card } from '../model/card';
import { parseMarkup, type Run } from '../model/markup';
import { skillText } from '../model/skills';
import { missionIconPositions, slotPlacement } from './iconLayout';
import type { AssetCache } from './assets';
import { cssFont, cssFontForStyle, type FontConfig } from './fonts';
import { boxToPx, coverDraw, ptToPx, type PxRect } from './geometry';
import { fitFlow, layoutRuns, type Measure, type PlacedLine, type Style } from './textLayout';

export interface RenderContext {
  catalog: Catalog;
  frame: Frame;
  template: Template;
  fonts: FontConfig;
  assets: AssetCache;
  userImage?: HTMLImageElement;
  base: string; // URL prefix for catalog files, e.g. '/frames/'
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  overflow: boolean;
}

const TEXT_COLOUR = '#141414';
const SKILL_BULLET = 'skill-dot';
const BASELINE_RATIO = 0.78; // baseline position inside a text box, as a fraction of its height

function iconFile(catalog: Catalog, id: string): string | undefined {
  return catalog.icons.find((i) => i.id === id)?.file;
}

async function loadIcons(ctx: RenderContext, ids: Iterable<string>): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const file = iconFile(ctx.catalog, id);
      if (!file) return;
      try {
        map.set(id, await ctx.assets.getImage(ctx.base + file));
      } catch {
        /* missing icon: skipped */
      }
    }),
  );
  return map;
}

function iconIds(runs: Run[]): string[] {
  return runs.flatMap((r) => (r.kind === 'icon' ? [r.id] : []));
}

function drawBoxText(
  g: CanvasRenderingContext2D,
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
  g.textBaseline = 'alphabetic';
  g.textAlign = align;
  const x = opts.x ?? (align === 'center' ? rect.x + rect.w / 2 : align === 'right' ? rect.x + rect.w : rect.x);
  g.fillStyle = TEXT_COLOUR;
  g.fillText(t, x, rect.y + rect.h * BASELINE_RATIO);
}

function drawPlacedLines(
  g: CanvasRenderingContext2D,
  lines: PlacedLine[],
  originX: number,
  originY: number,
  width: number,
  fonts: FontConfig,
  icons: Map<string, HTMLImageElement>,
  align: 'left' | 'center',
): void {
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = TEXT_COLOUR;
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
      g.fillText(piece.text, x, baseline);
    }
  }
}

export async function renderCard(card: Card, ctx: RenderContext): Promise<RenderResult> {
  const { frame, template: t, fonts } = ctx;
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
    const m = coverDraw({ w: ctx.userImage.naturalWidth, h: ctx.userImage.naturalHeight }, card.image.crop, artRect);
    g.save();
    g.beginPath();
    g.rect(artRect.x, artRect.y, artRect.w, artRect.h);
    g.clip();
    g.drawImage(ctx.userImage, m.sx, m.sy, m.sw, m.sh, m.dx, m.dy, m.dw, m.dh);
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

  const px = (pt: number) => ptToPx(pt, t.refWidthPt, W);
  const measure: Measure = (text, style, sizePx) => {
    g.font = cssFontForStyle(style, sizePx, fonts);
    return g.measureText(text).width;
  };

  // simple boxes
  const simple: Record<string, string> = {
    cost: card.fields.cost ?? '',
    title: displayTitle(card),
    subtitle: card.fields.subtitle ?? '',
    typeBar: typeBarText(card),
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
    drawBoxText(g, text, box, rect, px(box.sizePt), fonts, { maxWidth });
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
      drawBoxText(g, label, box, rect, size, fonts, { align: 'left', maxWidth: rect.w * 0.75 });
      const value = card.fields[fieldId] ?? '';
      if (value) drawBoxText(g, value, box, rect, size, fonts, { align: 'right' });
    });
  }

  // icons needed for flow + skills
  const gameRuns = parseMarkup(card.fields.gameText ?? '');
  const loreRuns = parseMarkup(card.fields.lore ?? '');
  const reqRuns = parseMarkup(card.fields.requirements ?? '');
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
  const hqLabel = card.type === 'mission' ? (card.fields.hqLabel ?? '').trim() : '';
  if (hqLabel && t.missionAffiliations) {
    const strip = t.missionAffiliations;
    const titleBox = t.boxes.title;
    const size = px((titleBox?.sizePt ?? 8) * 1.05);
    g.save();
    g.font = cssFont('title', size, fonts);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(hqLabel, W / 2, strip.cy * H);
    g.restore();
  }

  // mission affiliation icons along the bottom strip, centred (a headquarters label takes their place)
  if (card.type === 'mission' && t.missionAffiliations && listIcons.length && !hqLabel) {
    const positions = missionIconPositions(listIcons.length, t.missionAffiliations, W, H);
    listIcons.forEach((id, i) => {
      const img = icons.get(id);
      if (!img) return;
      const p = positions[i];
      // fit the emblem into a p.w square: wide marks fill the width, tall ones the height
      const scale = p.w / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
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
  const quadrant = card.type === 'mission' ? QUADRANTS[(card.fields.quadrant ?? '').toUpperCase()] : undefined;
  if (t.quadrant && quadrant) {
    const q = t.quadrant;
    const cx = q.cx * W;
    const cy = q.cy * H;
    const r = q.r * W;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = q.fill;
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
    g.fillStyle = TEXT_COLOUR;
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
      g.fillText(text, x + bullet + gap, baseline);
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
    drawPlacedLines(g, placed, rect.x, rect.y, rect.w, fonts, icons, 'center');
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
  );
  drawPlacedLines(g, fit.lines, flowRect.x, flowTop, flowRect.w, fonts, icons, 'left');

  return { canvas, overflow: fit.overflow };
}
