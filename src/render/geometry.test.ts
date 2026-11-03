import { describe, it, expect } from 'vitest';
import { cardBorderPx } from './geometry';

describe('cardBorderPx', () => {
  it('converts the border and corner to pixels of the frame width', () => {
    const { pad, radius } = cardBorderPx({ refWidthPt: 163.52, card: { borderPt: 7.5, cornerPt: 7.08 } }, 1022);
    expect(pad).toBe(47);
    expect(radius).toBeCloseTo(44.25, 1);
  });
  it('is zero when the image already carries the border', () => {
    expect(cardBorderPx({ refWidthPt: 178.58, card: { borderPt: 0, cornerPt: 0 } }, 744)).toEqual({ pad: 0, radius: 0 });
    expect(cardBorderPx({ refWidthPt: 178.58 }, 744)).toEqual({ pad: 0, radius: 0 });
  });
});
import { ptToPx, boxToPx, coverDraw, centredCrop } from './geometry';

describe('geometry', () => {
  it('converts PDF points to frame pixels', () => {
    expect(ptToPx(8, 163.5, 1022)).toBeCloseTo(50.005, 2);
    expect(ptToPx(7, 180, 744)).toBeCloseTo(28.93, 2);
  });

  it('converts a fractional box to pixels', () => {
    const r = boxToPx({ x0: 0.1, y0: 0.2, x1: 0.6, y1: 0.7 }, 1000, 2000);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(400);
    expect(r.w).toBeCloseTo(500);
    expect(r.h).toBeCloseTo(1000);
  });

  it('coverDraw maps an exact-aspect crop one to one', () => {
    const r = coverDraw({ w: 400, h: 300 }, { x: 0, y: 0, w: 400, h: 300 }, { x: 10, y: 20, w: 800, h: 600 });
    expect(r).toEqual({ sx: 0, sy: 0, sw: 400, sh: 300, dx: 10, dy: 20, dw: 800, dh: 600 });
  });

  it('coverDraw trims a crop that is wider than the destination, centred', () => {
    // crop 400x100 into 200x200 box: scale by height (2x) -> only 100 source px wide fit
    const r = coverDraw({ w: 400, h: 100 }, { x: 0, y: 0, w: 400, h: 100 }, { x: 0, y: 0, w: 200, h: 200 });
    expect(r.sh).toBe(100);
    expect(r.sw).toBe(100);
    expect(r.sx).toBe(150);
    expect(r.sy).toBe(0);
  });

  it('coverDraw trims a crop that is taller than the destination, centred', () => {
    const r = coverDraw({ w: 100, h: 400 }, { x: 0, y: 0, w: 100, h: 400 }, { x: 0, y: 0, w: 200, h: 200 });
    expect(r.sw).toBe(100);
    expect(r.sh).toBe(100);
    expect(r.sy).toBe(150);
  });

  it('coverDraw clamps the crop to the source image', () => {
    const r = coverDraw({ w: 100, h: 100 }, { x: -10, y: 50, w: 200, h: 100 }, { x: 0, y: 0, w: 100, h: 50 });
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.sw).toBeLessThanOrEqual(100);
    expect(r.sy + r.sh).toBeLessThanOrEqual(100);
  });

  it('centredCrop returns the largest centred rect of the requested aspect', () => {
    expect(centredCrop(1000, 500, 2)).toEqual({ x: 0, y: 0, w: 1000, h: 500 });
    expect(centredCrop(1000, 1000, 2)).toEqual({ x: 0, y: 250, w: 1000, h: 500 });
    expect(centredCrop(500, 1000, 2)).toEqual({ x: 0, y: 375, w: 500, h: 250 });
  });
});
