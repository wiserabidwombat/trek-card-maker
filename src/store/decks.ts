import type { Card } from '../model/card';

/** A named deck; its cards are the stored cards whose `deckId` matches. */
export interface DeckMeta {
  id: string;
  name: string;
  createdAt: number;
}

export const DEFAULT_DECK_ID = 'default';
export const DEFAULT_DECK_NAME = 'My deck';

export function newDeckId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultDeck(now = Date.now()): DeckMeta {
  return { id: DEFAULT_DECK_ID, name: DEFAULT_DECK_NAME, createdAt: now };
}

/**
 * First run with decks: cards saved before decks existed have no `deckId`. They all go into the
 * default deck, which is created if the registry is empty. Returns the registry to store and the
 * cards that need re-saving.
 */
export function migrateLegacy(decks: DeckMeta[], cards: Card[], now = Date.now()): { decks: DeckMeta[]; stamped: Card[] } {
  const orphans = cards.filter((c) => !c.deckId);
  let out = decks;
  if (!out.length || (orphans.length && !out.some((d) => d.id === DEFAULT_DECK_ID))) {
    out = [...out, defaultDeck(now)];
  }
  return { decks: out, stamped: orphans.map((c) => ({ ...c, deckId: DEFAULT_DECK_ID })) };
}

/** "Deck 2", "Deck 3"… or the wanted name with a number when it is already taken. */
export function uniqueDeckName(wanted: string, existing: DeckMeta[]): string {
  const taken = new Set(existing.map((d) => d.name.trim().toLowerCase()));
  const base = wanted.trim() || 'Deck';
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Lower-case ASCII slug of a deck name for file names; empty when nothing survives. */
export function deckSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** File name for a deck export: "trek-deck-klingon-aggro.json". */
export function deckFileName(name: string): string {
  return `trek-deck-${deckSlug(name) || 'deck'}.json`;
}

/** Deck name to use for an imported file: the file's own name field, else its file name. */
export function importedDeckName(fileName: string, embedded: string | undefined, existing: DeckMeta[]): string {
  const fromFile = fileName.replace(/\.json$/i, '').replace(/^trek-deck-/, '').replace(/[-_]+/g, ' ').trim();
  return uniqueDeckName(embedded?.trim() || fromFile || 'Imported deck', existing);
}
