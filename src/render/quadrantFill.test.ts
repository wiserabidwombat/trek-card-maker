import { describe, expect, it } from 'vitest';
import { quadrantFill } from './renderCard';

describe('quadrantFill', () => {
  const q = { fill: '#0d1f3c', fills: { A: '#173541', D: '#222d16', G: '#4e1b0e' } };

  it('uses the colour measured for the quadrant', () => {
    expect(quadrantFill(q, 'G')).toBe('#4e1b0e');
    expect(quadrantFill(q, 'a')).toBe('#173541');
  });

  it('falls back to the template fill for quadrants without a measurement', () => {
    expect(quadrantFill(q, 'X')).toBe('#0d1f3c');
    expect(quadrantFill({ fill: '#0d1f3c' }, 'D')).toBe('#0d1f3c');
  });
});
