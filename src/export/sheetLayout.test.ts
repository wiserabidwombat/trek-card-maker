import { describe, it, expect } from 'vitest';
import { layoutSheet, cutMarks, LETTER, CARD, MARGIN, PER_PAGE, marginFor, mirrorSlots, bleedRect, shiftSlots, MM } from './sheetLayout';
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

describe('mirrorSlots', () => {
  it('flips columns so the back of the first card sits where the third card was', () => {
    const front = layoutSheet(9);
    const back = mirrorSlots(front);
    expect(back[0].x).toBeCloseTo(front[2].x, 6);
    expect(back[2].x).toBeCloseTo(front[0].x, 6);
    expect(back[1].x).toBeCloseTo(front[1].x, 6);
    expect(back[0].y).toBe(front[0].y);
    expect(back[0].page).toBe(0);
    const a4 = mirrorSlots(layoutSheet(3, 'a4'), 'a4');
    expect(a4[0].x + a4[0].w).toBeCloseTo(595.28 - marginFor('a4').x, 1);
  });
});

describe('bleedRect', () => {
  it('grows a slot by the bleed on every side', () => {
    const slot = layoutSheet(1)[0];
    const r = bleedRect(slot, 5.67);
    expect(r.x).toBeCloseTo(slot.x - 5.67, 5);
    expect(r.y).toBeCloseTo(slot.y - 5.67, 5);
    expect(r.w).toBeCloseTo(slot.w + 11.34, 5);
    expect(r.h).toBeCloseTo(slot.h + 11.34, 5);
  });

  it('stays inside the page and clear of the cut marks on both papers', () => {
    for (const paper of ['letter', 'a4'] as const) {
      const r = bleedRect(layoutSheet(1, paper)[0], 2 * MM);
      expect(r.x).toBeGreaterThan(8); // marks are 8pt hairlines at the page edge
      expect(r.y + r.h).toBeLessThan(PAPERS[paper].h - 8);
    }
  });
});

describe('shiftSlots', () => {
  it('moves every slot by the offset and leaves the input alone', () => {
    const slots = mirrorSlots(layoutSheet(2));
    const moved = shiftSlots(slots, 1.5, -0.8);
    expect(moved[0].x - slots[0].x).toBeCloseTo(1.5, 9);
    expect(moved[0].y - slots[0].y).toBeCloseTo(-0.8, 9);
    expect(moved[1].x).toBeCloseTo(slots[1].x + 1.5, 9);
    expect(moved[1].page).toBe(slots[1].page);
    expect(slots[0].x).toBe(mirrorSlots(layoutSheet(2))[0].x);
  });

  it('returns the same slots for a zero offset', () => {
    const slots = layoutSheet(3);
    expect(shiftSlots(slots, 0, 0)).toBe(slots);
  });
});
