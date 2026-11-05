import { MM, PAPERS, type Paper } from './paper';

export { MM };
export const LETTER = PAPERS.letter;
/** 63 x 88 mm, the size TrekCC prints (and standard CCG sleeves take), in PDF points. */
export const CARD = { w: 63 * MM, h: 88 * MM }; // 178.58 x 249.45 pt
export const GRID = { cols: 3, rows: 3 };
export const PER_PAGE = GRID.cols * GRID.rows;
const MARK_LEN = 8;

/** Margins that centre the 3x3 grid on the chosen paper (Letter: 38.13 x 21.83 pt, matching TrekCC's sheets; A4: 29.76 x 46.77 pt). */
export function marginFor(paper: Paper = 'letter'): { x: number; y: number } {
  const p = PAPERS[paper];
  return { x: (p.w - GRID.cols * CARD.w) / 2, y: (p.h - GRID.rows * CARD.h) / 2 };
}
export const MARGIN = marginFor('letter');

export interface Slot {
  page: number;
  x: number;
  y: number; // PDF coordinate: distance from the bottom edge
  w: number;
  h: number;
}

export function layoutSheet(count: number, paper: Paper = 'letter'): Slot[] {
  const size = PAPERS[paper];
  const margin = marginFor(paper);
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const page = Math.floor(i / PER_PAGE);
    const k = i % PER_PAGE;
    const col = k % GRID.cols;
    const row = Math.floor(k / GRID.cols);
    slots.push({
      page,
      x: margin.x + col * CARD.w,
      y: size.h - margin.y - (row + 1) * CARD.h,
      w: CARD.w,
      h: CARD.h,
    });
  }
  return slots;
}

/**
 * Slots for the reverse side of a sheet: the same grid mirrored left to right, so that after a
 * long-edge duplex flip each back lands behind its front.
 */
export function mirrorSlots(slots: Slot[], paper: Paper = 'letter'): Slot[] {
  const size = PAPERS[paper];
  return slots.map((s) => ({ ...s, x: size.w - s.x - s.w }));
}

/** Every slot moved by (dx, dy) points: the duplex offset applied to the back pages. */
export function shiftSlots(slots: Slot[], dx: number, dy: number): Slot[] {
  if (!dx && !dy) return slots;
  return slots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
}

/** The slot grown by `bleed` points on every side: the area filled with border colour under the card. */
export function bleedRect(slot: Slot, bleed: number): { x: number; y: number; w: number; h: number } {
  return { x: slot.x - bleed, y: slot.y - bleed, w: slot.w + 2 * bleed, h: slot.h + 2 * bleed };
}

export interface Mark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Short hairlines in the page margins aligned with every vertical and horizontal grid line. */
export function cutMarks(paper: Paper = 'letter'): Mark[] {
  const size = PAPERS[paper];
  const margin = marginFor(paper);
  const marks: Mark[] = [];
  for (let c = 0; c <= GRID.cols; c++) {
    const x = margin.x + c * CARD.w;
    marks.push({ x1: x, y1: 0, x2: x, y2: MARK_LEN });
    marks.push({ x1: x, y1: size.h - MARK_LEN, x2: x, y2: size.h });
  }
  for (let r = 0; r <= GRID.rows; r++) {
    const y = margin.y + r * CARD.h;
    marks.push({ x1: 0, y1: y, x2: MARK_LEN, y2: y });
    marks.push({ x1: size.w - MARK_LEN, y1: y, x2: size.w, y2: y });
  }
  return marks;
}
