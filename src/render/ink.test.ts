import { describe, it, expect } from 'vitest';
import { inkColour } from './ink';

describe('inkColour', () => {
  it('turns the source rich blacks into pure black', () => {
    expect(inkColour('#231f20')).toBe('#000000');
    expect(inkColour('#030404')).toBe('#000000');
  });
  it('keeps white and light colours', () => {
    expect(inkColour('#ffffff')).toBe('#ffffff');
    expect(inkColour('#FFEEDD')).toBe('#ffeedd');
  });
  it('defaults to black', () => {
    expect(inkColour(undefined)).toBe('#000000');
    expect(inkColour('nope')).toBe('#000000');
  });
});
