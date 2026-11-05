import { describe, it, expect } from 'vitest';
import { layoutRuns, fitFlow, type Measure } from './textLayout';
import type { Run } from '../model/markup';

const measure: Measure = (t, s, px) => t.length * px * 0.5 * (s.bold ? 1.1 : 1);
const text = (t: string, bold = false, italic = false): Run => ({ kind: 'text', text: t, bold, italic });

describe('layoutRuns', () => {
  it('wraps greedily at word boundaries', () => {
    // each char is 5px at size 10; "aaaa bbbb" = 45px, so width 50 fits two words, not three
    const lines = layoutRuns([text('aaaa bbbb cccc')], 50, 10, measure, 10);
    expect(lines.map((l) => l.pieces.map((p) => p.text).join(''))).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('forces a new line on break runs and keeps styles per piece', () => {
    const lines = layoutRuns([text('ab', true), { kind: 'break' }, text('cd')], 500, 10, measure, 10);
    expect(lines).toHaveLength(2);
    expect(lines[0].pieces[0].style.bold).toBe(true);
    expect(lines[1].pieces[0].text).toBe('cd');
  });

  it('treats icons as inline boxes of iconWidth', () => {
    const lines = layoutRuns([text('aa '), { kind: 'icon', id: 'x' }, text(' bb')], 500, 10, measure, 12);
    const icon = lines[0].pieces.find((p) => p.icon);
    expect(icon?.width).toBe(12);
    expect(lines[0].width).toBeCloseTo(15 + 12 + 15);
  });

  it('drops the leading space of a wrapped line', () => {
    const lines = layoutRuns([text('aaaa'), text(' bbbb')], 25, 10, measure, 10);
    expect(lines.map((l) => l.pieces.map((p) => p.text).join(''))).toEqual(['aaaa', 'bbbb']);
  });

  it('breaks words longer than the line by character', () => {
    const lines = layoutRuns([text('abcdefghij')], 25, 10, measure, 10);
    expect(lines.map((l) => l.pieces.map((p) => p.text).join(''))).toEqual(['abcde', 'fghij']);
  });
});

describe('fitFlow', () => {
  const block = (t: string, scale = 1) => ({ runs: [text(t)], style: { bold: false, italic: false }, sizeScale: scale, gapBefore: 0 });

  it('reports no overflow when everything fits', () => {
    const r = fitFlow([block('aaaa bbbb')], 100, 100, 10, 12, measure, 10);
    expect(r.overflow).toBe(false);
    expect(r.sizePx).toBe(10);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].y).toBe(0);
  });

  it('shrinks the size until the text fits', () => {
    const many = Array.from({ length: 20 }, () => 'aaaa').join(' ');
    // 20 words: 5 lines at full size (60px) do not fit in 36px, so the size must shrink
    const r = fitFlow([block(many)], 100, 36, 10, 12, measure, 10);
    expect(r.overflow).toBe(false);
    expect(r.sizePx).toBeLessThan(10);
    const last = r.lines[r.lines.length - 1];
    expect(last.y + last.lineHeightPx).toBeLessThanOrEqual(36 + 1e-6);
  });

  it('flags overflow at the minimum scale', () => {
    const many = Array.from({ length: 200 }, () => 'aaaa').join(' ');
    const r = fitFlow([block(many)], 100, 24, 10, 12, measure, 10);
    expect(r.overflow).toBe(true);
    expect(r.sizePx).toBeCloseTo(7, 5);
    expect(r.scale).toBeCloseTo(0.7, 5);
  });

  it('reports the scale used and respects a higher floor', () => {
    expect(fitFlow([block('aaaa')], 100, 100, 10, 12, measure, 10).scale).toBe(1);
    const many = Array.from({ length: 20 }, () => 'aaaa').join(' ');
    // fits after shrinking a little with the default floor, but not within the cards' 6.5/7 floor
    const loose = fitFlow([block(many)], 100, 36, 10, 12, measure, 10);
    expect(loose.overflow).toBe(false);
    expect(loose.scale).toBeLessThan(1);
    const strict = fitFlow([block(many)], 100, 36, 10, 12, measure, 10, 6.5 / 7);
    expect(strict.overflow).toBe(true);
    // the floor itself is the last size tried, so what is reported is exactly the floor
    expect(strict.scale).toBeCloseTo(6.5 / 7, 9);
    expect(strict.sizePx).toBeCloseTo(10 * (6.5 / 7), 6);
  });

  it('positions a second block after the first with its gap and scale', () => {
    const r = fitFlow([block('a'), { ...block('b', 0.9), gapBefore: 0.5 }], 100, 100, 10, 12, measure, 10);
    expect(r.lines[1].block).toBe(1);
    expect(r.lines[1].y).toBeCloseTo(12 + 0.5 * 12);
    expect(r.lines[1].sizePx).toBeCloseTo(9);
  });
});
