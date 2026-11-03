import { describe, it, expect } from 'vitest';
import { hexToRgb01, mapTextOp, specKey } from './textOps';

describe('textOps', () => {
  it('maps card pixels into a slot in PDF points with a flipped y axis', () => {
    // 1000x1400 px card into a 100x140 pt slot at (38, 21): 10 px per pt
    const p = mapTextOp({ x: 100, y: 700, sizePx: 70 }, { x: 38, y: 21, w: 100, h: 140 }, 1000, 1400);
    expect(p.x).toBeCloseTo(48);
    expect(p.y).toBeCloseTo(21 + 140 - 70);
    expect(p.size).toBeCloseTo(7);
  });

  it('parses hex colours', () => {
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb01('#ff0080')[2]).toBeCloseTo(128 / 255);
    expect(hexToRgb01('nope')).toEqual([0, 0, 0]);
  });

  it('keys font variants', () => {
    expect(specKey({ family: 'body', weight: 400, italic: false })).toBe('body:400:n');
    expect(specKey({ family: 'title', weight: 700, italic: true })).toBe('title:700:i');
  });
});
