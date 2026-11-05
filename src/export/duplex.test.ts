import { describe, expect, it } from 'vitest';
import { clampOffset, loadBackOffset, saveBackOffset } from './duplex';

describe('duplex offset', () => {
  it('clamps to ±5 mm in tenths and treats junk as zero', () => {
    expect(clampOffset(0.44)).toBe(0.4);
    expect(clampOffset(-7)).toBe(-5);
    expect(clampOffset('1.25')).toBe(1.3);
    expect(clampOffset('x')).toBe(0);
    expect(clampOffset(undefined)).toBe(0);
  });

  it('round-trips through storage and defaults to zero', () => {
    localStorage.clear();
    expect(loadBackOffset()).toEqual({ x: 0, y: 0 });
    saveBackOffset({ x: 0.5, y: -0.3 });
    expect(loadBackOffset()).toEqual({ x: 0.5, y: -0.3 });
    localStorage.setItem('trek-card-maker.back-offset', 'not json');
    expect(loadBackOffset()).toEqual({ x: 0, y: 0 });
  });
});
