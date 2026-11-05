import { describe, it, expect } from 'vitest';
import { artPrintDpi, artQuality, describeArtQuality, pixelsForGood } from './artQuality';

// A typical personnel art box spans about 0.9 of the card: 56.7 mm, 2.23 in.
const FRACTION = 0.9;

describe('artPrintDpi', () => {
  it('divides the cropped source pixels by the printed width of the art box', () => {
    expect(artPrintDpi({ w: 670 }, FRACTION)).toBeCloseTo(300, 0);
    expect(artPrintDpi({ w: 335 }, FRACTION)).toBeCloseTo(150, 0);
  });

  it('is zero for degenerate input', () => {
    expect(artPrintDpi({ w: 0 }, FRACTION)).toBe(0);
    expect(artPrintDpi({ w: 500 }, 0)).toBe(0);
  });
});

describe('artQuality', () => {
  it('rates by the 300 and 200 dpi thresholds', () => {
    expect(artQuality(450)).toBe('good');
    expect(artQuality(300)).toBe('good');
    expect(artQuality(299)).toBe('soft');
    expect(artQuality(200)).toBe('soft');
    expect(artQuality(199)).toBe('low');
  });
});

describe('describeArtQuality', () => {
  it('says nothing for good artwork and names the pixels needed otherwise', () => {
    expect(describeArtQuality(320, FRACTION)).toBeNull();
    expect(pixelsForGood(FRACTION)).toBe(670);
    expect(describeArtQuality(248, FRACTION)).toBe('Prints at about 250 dpi: slightly soft. 670 px across the cropped area gives 300 dpi.');
    expect(describeArtQuality(96, FRACTION)).toBe('Prints at about 100 dpi: it will look blurry. 670 px across the cropped area gives 300 dpi.');
  });
});
