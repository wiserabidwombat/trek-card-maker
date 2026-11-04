import type { Card } from './card';

/**
 * Give every card an explicit position. Cards that already have one keep it; the rest are
 * appended in their current sequence. Returns the normalised list and the cards that changed.
 */
export function normalizeOrder(cards: Card[]): { cards: Card[]; changed: Card[] } {
  const sorted = [...cards].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.updatedAt - b.updatedAt);
  const changed: Card[] = [];
  const out = sorted.map((c, i) => {
    if (c.order === i) return c;
    const next = { ...c, order: i };
    changed.push(next);
    return next;
  });
  return { cards: out, changed };
}

/** Move the card at `from` to sit at `to`, then renumber. */
export function moveCard(cards: Card[], from: number, to: number): { cards: Card[]; changed: Card[] } {
  if (from === to || from < 0 || to < 0 || from >= cards.length || to >= cards.length) return { cards, changed: [] };
  const list = [...cards];
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return renumber(list);
}

/** Give the list positions 0..n-1, returning the cards whose position changed. */
function renumber(list: Card[]): { cards: Card[]; changed: Card[] } {
  const changed: Card[] = [];
  const cards = list.map((c, i) => {
    if (c.order === i) return c;
    const next = { ...c, order: i };
    changed.push(next);
    return next;
  });
  return { cards, changed };
}

/** Apply an explicit id sequence (from an undo step), ignoring ids that no longer exist. */
export function applyOrder(cards: Card[], ids: string[]): { cards: Card[]; changed: Card[] } {
  const rank = new Map(ids.map((id, i) => [id, i]));
  const list = [...cards].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  return renumber(list);
}

export function nextOrder(cards: Card[]): number {
  return cards.reduce((m, c) => Math.max(m, c.order ?? -1), -1) + 1;
}

/** Case-insensitive match against the deck-list text: name, title, type, frame. */
export function matchesFilter(card: Card, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return [card.name, card.fields.title, card.fields.subtitle, card.type, card.frameId].some((v) => (v ?? '').toLowerCase().includes(q));
}
