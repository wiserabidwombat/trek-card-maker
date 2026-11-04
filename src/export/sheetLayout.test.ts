import { describe, it, expect } from 'vitest';
import { layoutSheet, cutMarks, LETTER, CARD, MARGIN, PER_PAGE, marginFor, MM } from './sheetLayout';
import { PAPERS } from './paper';

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

describe('A4 sheets', () => {
  it('centres the same 3x3 grid on A4 with 10.5 mm side and 16.5 mm top/bottom margins', () => {
    const m = marginFor('a4');
    expect(m.x).toBeCloseTo(10.5 * MM, 6);
    expect(m.y).toBeCloseTo(16.5 * MM, 6);
    expect(PAPERS.a4.w).toBeCloseTo(595.28, 2);
    expect(PAPERS.a4.h).toBeCloseTo(841.89, 2);
  });

  it('lays out slots and cut marks against the A4 page edges', () => {
    const slots = layoutSheet(9, 'a4');
    expect(slots[0].x).toBeCloseTo(marginFor('a4').x, 6);
    expect(slots[0].y).toBeCloseTo(PAPERS.a4.h - marginFor('a4').y - CARD.h, 6);
    expect(slots[8].y).toBeCloseTo(marginFor('a4').y, 6);
    const marks = cutMarks('a4');
    expect(marks).toHaveLength(16);
    expect(Math.max(...marks.map((k) => k.x2))).toBeCloseTo(PAPERS.a4.w, 6);
    expect(Math.max(...marks.map((k) => k.y2))).toBeCloseTo(PAPERS.a4.h, 6);
  });

  it('keeps the Letter layout unchanged by default', () => {
    expect(layoutSheet(1)).toEqual(layoutSheet(1, 'letter'));
    expect(cutMarks()).toEqual(cutMarks('letter'));
  });
});
