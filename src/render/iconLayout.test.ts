import { describe, it, expect } from 'vitest';
import { missionIconPositions, slotPlacement } from './iconLayout';

describe('iconLayout', () => {
  it('centres mission icons on the card', () => {
    const p = missionIconPositions(3, { cy: 0.9, step: 0.08, size: 0.06 }, 1000, 1400);
    expect(p.map((x) => x.cx)).toEqual([420, 500, 580]);
    expect(p[0].cy).toBe(1260);
    expect(p[0].w).toBe(60);
    expect(missionIconPositions(0, { cy: 0.9, step: 0.08, size: 0.06 }, 1000, 1400)).toEqual([]);
    expect(missionIconPositions(1, { cy: 0.9, step: 0.08, size: 0.06 }, 1000, 1400)[0].cx).toBe(500);
  });

  it('places ring and inner icon in a slot', () => {
    const { ring, icon } = slotPlacement({ cx: 0.1, cy: 0.5, size: 0.08 }, 1000, 1400);
    expect(ring).toEqual({ cx: 100, cy: 700, w: 80 });
    expect(icon.w).toBeCloseTo(57.6);
  });
});
