import type { Card } from '../model/card';
import type { FontConfig } from '../render/fonts';

export interface Thumb {
  /** What the picture was made from; a different key means it is stale. */
  key: string;
  /** Data URL of the shrunken render, or empty when rendering failed. */
  url: string;
  overflow: boolean;
  error?: string;
}

/** Everything a card's picture depends on. */
export function thumbKey(card: Card, fonts: FontConfig): string {
  return `${card.id}|${card.updatedAt}|${card.frameId}|${card.image?.blobKey ?? ''}|${fonts.title}|${fonts.body}|${fonts.heavier ? 'h' : ''}`;
}

/** Cards whose thumbnail is missing or stale, in deck order with the current card first so it refreshes soonest. */
export function pendingThumbs(cards: Card[], cache: Map<string, Thumb>, fonts: FontConfig, currentId: string | null): Card[] {
  const pending = cards.filter((c) => cache.get(c.id)?.key !== thumbKey(c, fonts));
  const i = pending.findIndex((c) => c.id === currentId);
  if (i > 0) {
    const [cur] = pending.splice(i, 1);
    pending.unshift(cur);
  }
  return pending;
}

/** Drop pictures of cards that no longer exist so the cache follows the deck. */
export function pruneThumbs(cards: Card[], cache: Map<string, Thumb>): Map<string, Thumb> {
  const ids = new Set(cards.map((c) => c.id));
  let changed = false;
  const next = new Map<string, Thumb>();
  for (const [id, t] of cache) {
    if (ids.has(id)) next.set(id, t);
    else changed = true;
  }
  return changed ? next : cache;
}
