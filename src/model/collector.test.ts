import { describe, expect, it } from 'vitest';
import { formatCollector, looseCollector, nextCollector, parseCollector } from './collector';

describe('collector info', () => {
  it('parses the printed form', () => {
    expect(parseCollector('25 V 1')).toEqual({ set: '25', rarity: 'V', number: '1' });
    expect(parseCollector(' 0 vp 77 ')).toEqual({ set: '0', rarity: 'VP', number: '77' });
    expect(parseCollector('1 C')).toBeNull();
    expect(parseCollector('set one')).toBeNull();
    expect(parseCollector('')).toBeNull();
  });

  it('splits partial strings for the editor boxes', () => {
    expect(looseCollector('25 V')).toEqual({ set: '25', rarity: 'V', number: '' });
    expect(looseCollector('25 V 1')).toEqual({ set: '25', rarity: 'V', number: '1' });
    expect(looseCollector('7')).toEqual({ set: '7', rarity: '', number: '' });
    expect(looseCollector('set one')).toEqual({ set: '', rarity: '', number: '' });
  });

  it('formats parts, leaving out what is missing', () => {
    expect(formatCollector({ set: '25', rarity: 'v', number: '1' })).toBe('25 V 1');
    expect(formatCollector({ set: '25', rarity: '', number: '' })).toBe('25');
    expect(formatCollector({})).toBe('');
  });

  it('numbers the next card in the same set', () => {
    expect(nextCollector('25 V 1')).toBe('25 V 2');
    expect(nextCollector('1 C 009')).toBe('1 C 010');
    expect(nextCollector('1 C 99')).toBe('1 C 100');
    expect(nextCollector('')).toBe('');
    expect(nextCollector('one')).toBe('');
  });
});
