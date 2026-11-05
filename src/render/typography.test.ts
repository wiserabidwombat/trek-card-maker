import { describe, it, expect } from 'vitest';
import { typeset } from './typography';

describe('typeset', () => {
  it('curls double quotes by position', () => {
    expect(typeset('"Today is a good day to die."')).toBe('“Today is a good day to die.”');
    expect(typeset('He said "no" twice')).toBe('He said “no” twice');
    expect(typeset('(a "b")')).toBe('(a “b”)');
  });

  it('treats markup markers as openers so quoted italics work', () => {
    expect(typeset('*"Engage."*')).toBe('*“Engage.”*');
    expect(typeset('**"Kai"**')).toBe('**“Kai”**');
  });

  it('tells apostrophes from single quotes', () => {
    expect(typeset("Worf's bat'leth")).toBe('Worf’s bat’leth');
    expect(typeset("'Q' is back")).toBe('‘Q’ is back');
    expect(typeset("the ships' crews")).toBe('the ships’ crews');
  });

  it('turns spaced and doubled hyphens into dashes, but leaves compounds alone', () => {
    expect(typeset('**Order** - Stop this personnel')).toBe('**Order** – Stop this personnel');
    expect(typeset('Order -')).toBe('Order –');
    expect(typeset('a--b')).toBe('a–b');
    expect(typeset('a---b')).toBe('a—b');
    expect(typeset('Non-Aligned {icon:non-aligned} Strength -3')).toBe('Non-Aligned {icon:non-aligned} Strength -3');
  });

  it('replaces three dots with an ellipsis', () => {
    expect(typeset('Wait for it...')).toBe('Wait for it…');
  });

  it('leaves plain text and empty strings unchanged', () => {
    expect(typeset('')).toBe('');
    expect(typeset('Cunning>30 and 2 Leadership')).toBe('Cunning>30 and 2 Leadership');
  });
});
