import { describe, it, expect } from 'vitest';
import { PROFILES, bodyWeight, profiledPt, sharpenPixels } from './printProfile';

describe('print profile', () => {
  it('bumps only small text on inkjet', () => {
    expect(profiledPt(7, PROFILES.inkjet)).toBeCloseTo(7.35);
    expect(profiledPt(8.5, PROFILES.inkjet)).toBe(8.5);
    expect(profiledPt(7, PROFILES.laser)).toBe(7);
  });

  it('uses heavier body weights on inkjet, bold unchanged', () => {
    expect(bodyWeight({}, false)).toBe(400);
    expect(bodyWeight({}, true)).toBe(500);
    expect(bodyWeight({ light: true }, false)).toBe(300);
    expect(bodyWeight({ light: true }, true)).toBe(400);
    expect(bodyWeight({ bold: true }, true)).toBe(700);
  });

  it('sharpening increases contrast at an edge and leaves flat areas and alpha alone', () => {
    const w = 5;
    const h = 3;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const v = x < 2 ? 50 : 200; // vertical edge between x=1 and x=2
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 123;
      }
    const out = sharpenPixels(data, w, h);
    const px = (x: number, y: number) => out[(y * w + x) * 4];
    expect(px(1, 1)).toBeLessThan(50); // dark side gets darker
    expect(px(2, 1)).toBeGreaterThan(200); // bright side gets brighter
    expect(out[(1 * w + 1) * 4 + 3]).toBe(123);
    // flat interior unchanged (x=3 has neighbours 200 on both sides except x=2... use edge pixels which are copied)
    expect(px(0, 0)).toBe(50);
  });
});
