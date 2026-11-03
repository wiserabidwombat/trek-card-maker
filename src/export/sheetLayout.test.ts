import { describe, it, expect } from 'vitest';
import { layoutSheet, cutMarks, LETTER, CARD, MARGIN, PER_PAGE } from './sheetLayout';

describe('layoutSheet', () => {
  it('places the first card top-left in PDF coordinates (origin bottom-left)', () => {
    const [s] = layoutSheet(1);
    expect(s).toEqual({ page: 0, x: MARGIN.x, y: LETTER.h - MARGIN.y - CARD.h, w: CARD.w, h: CARD.h });
    expect(CARD.w).toBeCloseTo(178.58, 2);
    expect(CARD.h).toBeCloseTo(249.45, 2);
    expect(MARGIN.x).toBeCloseTo(38.13, 2); // centred, as on the TrekCC HiRes sheets
    expect(MARGIN.y).toBeCloseTo(21.83, 2);
    expect(s.y).toBeCloseTo(520.72, 2);
  });

  it('fills rows left to right, then the next row down', () => {
    const slots = layoutSheet(9);
    expect(slots[1].x).toBe(MARGIN.x + CARD.w);
    expect(slots[3].x).toBe(MARGIN.x);
    expect(slots[3].y).toBe(LETTER.h - MARGIN.y - 2 * CARD.h);
    expect(slots[4].x).toBeCloseTo(216.71, 2);
  });

  it('starts a new page after nine cards', () => {
    const slots = layoutSheet(10);
    expect(slots[8].page).toBe(0);
    expect(slots[9].page).toBe(1);
    expect(slots[9].x).toBe(slots[0].x);
    expect(slots[9].y).toBe(slots[0].y);
    expect(PER_PAGE).toBe(9);
  });

  it('returns no slots for zero cards', () => {
    expect(layoutSheet(0)).toEqual([]);
  });
});

describe('cutMarks', () => {
  it('draws 8pt hairlines in the margins at every grid line', () => {
    const marks = cutMarks();
    expect(marks).toHaveLength(16);
    const v = marks.filter((m) => m.x1 === m.x2);
    const h = marks.filter((m) => m.y1 === m.y2);
    expect(v).toHaveLength(8);
    expect(h).toHaveLength(8);
    expect(v.some((m) => m.x1 === MARGIN.x && m.y1 === 0 && m.y2 === 8)).toBe(true);
    expect(v.some((m) => m.x1 === MARGIN.x + 3 * CARD.w && m.y1 === LETTER.h - 8)).toBe(true);
    expect(h.some((m) => m.y1 === MARGIN.y && m.x1 === 0 && m.x2 === 8)).toBe(true);
  });
});
