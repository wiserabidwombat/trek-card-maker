import type { Run } from '../model/markup';

export interface Style {
  bold: boolean;
  italic: boolean;
  light?: boolean;
}

export type Measure = (text: string, style: Style, sizePx: number) => number;

export interface Piece {
  x: number;
  text?: string;
  icon?: string;
  style: Style;
  width: number;
}

export interface Line {
  pieces: Piece[];
  width: number;
}

interface Token {
  text?: string;
  icon?: string;
  style: Style;
  isSpace: boolean;
  width: number;
}

function tokenize(runs: Run[], base: Style, sizePx: number, measure: Measure, iconWidth: number): (Token | 'break')[] {
  const out: (Token | 'break')[] = [];
  for (const run of runs) {
    if (run.kind === 'break') {
      out.push('break');
      continue;
    }
    if (run.kind === 'icon') {
      out.push({ icon: run.id, style: base, isSpace: false, width: iconWidth });
      continue;
    }
    const style: Style = { ...base, bold: run.bold || base.bold, italic: run.italic || base.italic };
    const parts = run.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const p of parts) {
      const isSpace = /^\s+$/.test(p);
      out.push({ text: p, style, isSpace, width: measure(p, style, sizePx) });
    }
  }
  return out;
}

function splitLongWord(tok: Token, maxWidth: number, sizePx: number, measure: Measure): Token[] {
  const text = tok.text ?? '';
  const pieces: Token[] = [];
  let cur = '';
  for (const ch of text) {
    const next = cur + ch;
    if (cur && measure(next, tok.style, sizePx) > maxWidth) {
      pieces.push({ ...tok, text: cur, width: measure(cur, tok.style, sizePx) });
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) pieces.push({ ...tok, text: cur, width: measure(cur, tok.style, sizePx) });
  return pieces;
}

export function layoutRuns(
  runs: Run[],
  maxWidth: number,
  sizePx: number,
  measure: Measure,
  iconWidth: number,
  base: Style = { bold: false, italic: false },
): Line[] {
  const tokens = tokenize(runs, base, sizePx, measure, iconWidth);
  const lines: Line[] = [];
  let cur: Piece[] = [];
  let x = 0;

  const endLine = () => {
    // trim trailing spaces
    while (cur.length && cur[cur.length - 1].text !== undefined && /^\s+$/.test(cur[cur.length - 1].text!)) cur.pop();
    const width = cur.length ? cur[cur.length - 1].x + cur[cur.length - 1].width : 0;
    lines.push({ pieces: cur, width });
    cur = [];
    x = 0;
  };

  const push = (t: Token) => {
    cur.push({ x, text: t.text, icon: t.icon, style: t.style, width: t.width });
    x += t.width;
  };

  for (const t of tokens) {
    if (t === 'break') {
      endLine();
      continue;
    }
    if (t.isSpace) {
      if (x === 0) continue; // drop leading space on a line
      push(t);
      continue;
    }
    if (x + t.width <= maxWidth || x === 0) {
      if (t.width > maxWidth && t.text !== undefined) {
        for (const part of splitLongWord(t, maxWidth, sizePx, measure)) {
          if (x > 0 && x + part.width > maxWidth) endLine();
          push(part);
        }
      } else {
        push(t);
      }
      continue;
    }
    endLine();
    if (t.width > maxWidth && t.text !== undefined) {
      for (const part of splitLongWord(t, maxWidth, sizePx, measure)) {
        if (x > 0 && x + part.width > maxWidth) endLine();
        push(part);
      }
    } else {
      push(t);
    }
  }
  if (cur.length || lines.length === 0) endLine();
  return lines;
}

export interface FlowBlock {
  runs: Run[];
  style: Style;
  sizeScale: number;
  gapBefore: number; // in line heights
}

export interface PlacedLine {
  block: number;
  line: Line;
  y: number; // top of the line box
  sizePx: number;
  lineHeightPx: number;
}

export interface FitResult {
  sizePx: number;
  lines: PlacedLine[];
  /** True when the text does not fit even at the smallest allowed size; the lines then run past the box. */
  overflow: boolean;
  /** The size actually used, as a fraction of the template size (1 = no shrinking). */
  scale: number;
}

/**
 * The smallest body text the printed cards use: measured over the 648 source cards, game text is
 * 7 pt and the densest cards drop to 6.5 pt, never lower. Text that needs less than this would not
 * fit on a real card, so it is reported as overflow rather than shrunk further.
 */
export const MIN_BODY_PT = 6.5;

function layoutBlocks(
  blocks: FlowBlock[],
  width: number,
  sizePx: number,
  lineHeightPx: number,
  measure: Measure,
  iconWidth: number,
): PlacedLine[] {
  const out: PlacedLine[] = [];
  let y = 0;
  blocks.forEach((b, bi) => {
    const hasContent = b.runs.some((r) => r.kind !== 'text' || r.text.trim().length > 0);
    if (!hasContent) return;
    const px = sizePx * b.sizeScale;
    const lh = lineHeightPx * b.sizeScale;
    const iw = iconWidth * b.sizeScale;
    if (out.length) y += b.gapBefore * lineHeightPx;
    const lines = layoutRuns(b.runs, width, px, measure, iw, b.style);
    for (const line of lines) {
      out.push({ block: bi, line, y, sizePx: px, lineHeightPx: lh });
      y += lh;
    }
  });
  return out;
}

function totalHeight(lines: PlacedLine[]): number {
  if (!lines.length) return 0;
  const last = lines[lines.length - 1];
  return last.y + last.lineHeightPx;
}

export function fitFlow(
  blocks: FlowBlock[],
  width: number,
  height: number,
  basePx: number,
  lineHeightPx: number,
  measure: Measure,
  iconWidth: number,
  minScale = 0.7,
  step = 0.02,
): FitResult {
  let scale = 1;
  for (;;) {
    const sizePx = basePx * scale;
    const lines = layoutBlocks(blocks, width, sizePx, lineHeightPx * scale, measure, iconWidth * scale);
    if (totalHeight(lines) <= height + 1e-6) return { sizePx, lines, overflow: false, scale };
    const next = +(scale - step).toFixed(4);
    if (next < minScale - 1e-9) {
      // the last step lands exactly on the floor before giving up, so the floor size itself is tried and reported
      if (scale > minScale + 1e-9) {
        scale = minScale;
        continue;
      }
      return { sizePx, lines, overflow: true, scale };
    }
    scale = next;
  }
}
