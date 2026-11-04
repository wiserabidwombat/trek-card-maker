import { describe, it, expect } from 'vitest';
import { applyOrder, matchesFilter, moveCard, nextOrder, normalizeOrder } from './order';
import { newCard, type Card } from './card';

const mk = (id: string, updatedAt: number, order?: number): Card => ({ ...newCard('personnel', 'personnel.klingon'), id, updatedAt, ...(order !== undefined ? { order } : {}) });

describe('card order', () => {
  it('appends unordered cards after ordered ones by edit time and reports changes', () => {
    const { cards, changed } = normalizeOrder([mk('b', 20), mk('a', 10), mk('z', 5, 0)]);
    expect(cards.map((c) => c.id)).toEqual(['z', 'a', 'b']);
    expect(cards.map((c) => c.order)).toEqual([0, 1, 2]);
    expect(changed.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('moves a card and renumbers only what moved', () => {
    const start = normalizeOrder([mk('a', 1), mk('b', 2), mk('c', 3), mk('d', 4)]).cards;
    const { cards, changed } = moveCard(start, 3, 1);
    expect(cards.map((c) => c.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(changed.map((c) => c.id).sort()).toEqual(['b', 'c', 'd']);
    expect(moveCard(start, 1, 1).changed).toEqual([]);
    expect(moveCard(start, 0, 9).changed).toEqual([]);
  });

  it('applies an id sequence from history, tolerating missing ids', () => {
    const start = normalizeOrder([mk('a', 1), mk('b', 2), mk('c', 3)]).cards;
    expect(applyOrder(start, ['c', 'gone', 'a', 'b']).cards.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(nextOrder(start)).toBe(3);
    expect(nextOrder([])).toBe(0);
  });

  it('filters on name, title, type and frame', () => {
    const c = { ...mk('a', 1), name: 'Big Worf', fields: { title: 'Worf', subtitle: 'Son of Mogh' } };
    expect(matchesFilter(c, '')).toBe(true);
    expect(matchesFilter(c, 'worf')).toBe(true);
    expect(matchesFilter(c, 'mogh')).toBe(true);
    expect(matchesFilter(c, 'PERSON')).toBe(true);
    expect(matchesFilter(c, 'klingon')).toBe(true);
    expect(matchesFilter(c, 'romulan')).toBe(false);
  });
});
