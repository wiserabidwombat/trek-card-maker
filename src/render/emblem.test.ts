import { describe, it, expect } from 'vitest';
import { emblemFit, EMBLEM_INSET } from './emblem';

describe('emblemFit', () => {
  it('centres a square picture on the disc, inset from its edge', () => {
    const r = emblemFit(100, 80, 50, 64, 64);
    expect(r.w).toBeCloseTo(100 * EMBLEM_INSET);
    expect(r.h).toBeCloseTo(100 * EMBLEM_INSET);
    expect(r.x + r.w / 2).toBeCloseTo(100);
    expect(r.y + r.h / 2).toBeCloseTo(80);
  });

  it('fits a wide picture by its width and a tall one by its height', () => {
    const wide = emblemFit(0, 0, 50, 200, 100, 1);
    expect(wide.w).toBeCloseTo(100);
    expect(wide.h).toBeCloseTo(50);
    const tall = emblemFit(0, 0, 50, 10, 40, 1);
    expect(tall.h).toBeCloseTo(100);
    expect(tall.w).toBeCloseTo(25);
  });

  it('does not divide by zero on an empty picture', () => {
    expect(emblemFit(0, 0, 50, 0, 0).w).toBe(0);
  });
});
