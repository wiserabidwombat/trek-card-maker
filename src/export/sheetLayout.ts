export const LETTER = { w: 612, h: 792 };
/** 63 x 88 mm, the size TrekCC prints (and standard CCG sleeves take), in PDF points. */
export const MM = 72 / 25.4;
export const CARD = { w: 63 * MM, h: 88 * MM }; // 178.58 x 249.45 pt
export const GRID = { cols: 3, rows: 3 };
export const MARGIN = { x: (LETTER.w - GRID.cols * CARD.w) / 2, y: (LETTER.h - GRID.rows * CARD.h) / 2 };
export const PER_PAGE = GRID.cols * GRID.rows;
const MARK_LEN = 8;

export interface Slot {
  page: number;
  x: number;
  y: number; // PDF coordinate: distance from the bottom edge
  w: number;
  h: number;
}

export function layoutSheet(count: number): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const page = Math.floor(i / PER_PAGE);
    const k = i % PER_PAGE;
    const col = k % GRID.cols;
    const row = Math.floor(k / GRID.cols);
    slots.push({
      page,
      x: MARGIN.x + col * CARD.w,
      y: LETTER.h - MARGIN.y - (row + 1) * CARD.h,
      w: CARD.w,
      h: CARD.h,
    });
  }
  return slots;
}

export interface Mark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Short hairlines in the page margins aligned with every vertical and horizontal grid line. */
export function cutMarks(): Mark[] {
  const marks: Mark[] = [];
  for (let c = 0; c <= GRID.cols; c++) {
    const x = MARGIN.x + c * CARD.w;
    marks.push({ x1: x, y1: 0, x2: x, y2: MARK_LEN });
    marks.push({ x1: x, y1: LETTER.h - MARK_LEN, x2: x, y2: LETTER.h });
  }
  for (let r = 0; r <= GRID.rows; r++) {
    const y = MARGIN.y + r * CARD.h;
    marks.push({ x1: 0, y1: y, x2: MARK_LEN, y2: y });
    marks.push({ x1: LETTER.w - MARK_LEN, y1: y, x2: LETTER.w, y2: y });
  }
  return marks;
}
