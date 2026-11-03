import { describe, it, expect } from 'vitest';
import { cssFont, cssFontForStyle, DEFAULT_FONTS } from './fonts';

describe('fonts', () => {
  it('builds CSS font strings per role', () => {
    expect(cssFont('title', 50, DEFAULT_FONTS)).toBe('italic 700 50px "Exo 2"');
    expect(cssFont('body', 30, DEFAULT_FONTS)).toBe('normal 400 30px "Fira Sans Condensed"');
    expect(cssFont('bodyBold', 30, DEFAULT_FONTS)).toBe('normal 700 30px "Fira Sans Condensed"');
    expect(cssFont('bodyLightItalic', 30, DEFAULT_FONTS)).toBe('italic 300 30px "Fira Sans Condensed"');
    expect(cssFont('bodyBoldSC', 30, DEFAULT_FONTS)).toBe('normal 700 30px "Fira Sans Condensed"');
  });

  it('builds CSS font strings from a style', () => {
    expect(cssFontForStyle({ bold: true, italic: true }, 20, DEFAULT_FONTS)).toBe('italic 700 20px "Fira Sans Condensed"');
    expect(cssFontForStyle({ bold: false, italic: true, light: true }, 20, DEFAULT_FONTS)).toBe(
      'italic 300 20px "Fira Sans Condensed"',
    );
  });

  it('uses custom families', () => {
    expect(cssFont('title', 10, { title: 'UserTitle', body: 'UserBody' })).toBe('italic 700 10px UserTitle');
  });
});
