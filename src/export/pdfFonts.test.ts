import { describe, it, expect } from 'vitest';
import { BUNDLED_FONTS, nearestBundled } from './pdfFonts';

describe('nearestBundled', () => {
  it('returns exact matches', () => {
    expect(nearestBundled({ family: 'body', weight: 500, italic: true })).toBe('body:500:i');
    expect(nearestBundled({ family: 'title', weight: 700, italic: true })).toBe('title:700:i');
  });

  it('falls back to the nearest weight with the same slant', () => {
    expect(nearestBundled({ family: 'body', weight: 600, italic: false })).toBe('body:500:n');
    expect(nearestBundled({ family: 'body', weight: 900, italic: true })).toBe('body:700:i');
  });

  it('uses the only title file for any title spec', () => {
    expect(nearestBundled({ family: 'title', weight: 400, italic: false })).toBe('title:700:i');
  });

  it('maps every bundled key to a file URL', () => {
    for (const url of Object.values(BUNDLED_FONTS)) expect(typeof url).toBe('string');
  });
});
