import { describe, it, expect } from 'vitest';
import { parseMarkup } from './markup';

describe('parseMarkup', () => {
  it('parses bold, italic, icons and line breaks', () => {
    const runs = parseMarkup('**Kai.** When *you* play {icon:bajoran} cards\nnext');
    expect(runs).toEqual([
      { kind: 'text', text: 'Kai.', bold: true, italic: false },
      { kind: 'text', text: ' When ', bold: false, italic: false },
      { kind: 'text', text: 'you', bold: false, italic: true },
      { kind: 'text', text: ' play ', bold: false, italic: false },
      { kind: 'icon', id: 'bajoran' },
      { kind: 'text', text: ' cards', bold: false, italic: false },
      { kind: 'break' },
      { kind: 'text', text: 'next', bold: false, italic: false },
    ]);
  });

  it('keeps unmatched markers literal', () => {
    expect(parseMarkup('a ** b')).toEqual([{ kind: 'text', text: 'a ** b', bold: false, italic: false }]);
    expect(parseMarkup('a *b')).toEqual([{ kind: 'text', text: 'a *b', bold: false, italic: false }]);
    expect(parseMarkup('{icon:}')).toEqual([{ kind: 'text', text: '{icon:}', bold: false, italic: false }]);
  });

  it('supports bold inside italic', () => {
    expect(parseMarkup('*a **b** c*')).toEqual([
      { kind: 'text', text: 'a ', bold: false, italic: true },
      { kind: 'text', text: 'b', bold: true, italic: true },
      { kind: 'text', text: ' c', bold: false, italic: true },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseMarkup('')).toEqual([]);
  });
});
