import { createStore, get, set, del, keys, getMany, delMany } from 'idb-keyval';
import type { Card } from '../model/card';
import { migrateLegacy, type DeckMeta } from './decks';

const store = createStore('trek-card-maker', 'kv');

const CARD_PREFIX = 'card:';
const FONT_PREFIX = 'font:';
const IMAGE_PREFIX = 'img-';
const DECKS_KEY = 'decks';
const CURRENT_DECK_KEY = 'currentDeck';

/** Keys that belong to cards and their images; fonts and anything else are left alone. */
export function isCardOrImageKey(key: unknown): key is string {
  return typeof key === 'string' && (key.startsWith(CARD_PREFIX) || key.startsWith(IMAGE_PREFIX));
}

/**
 * Remove stored cards and images: every one when no deck is given, otherwise the deck's cards and
 * the images they reference. Returns how many cards were removed.
 */
export async function clearCardsAndImages(deckId?: string): Promise<number> {
  if (deckId === undefined) {
    const all = await keys(store);
    const doomed = all.filter(isCardOrImageKey);
    await delMany(doomed, store);
    return doomed.filter((k) => k.startsWith(CARD_PREFIX)).length;
  }
  const cards = await listCards(deckId);
  const doomed = cards.flatMap((c) => [CARD_PREFIX + c.id, ...(c.image ? [c.image.blobKey] : [])]);
  await delMany(doomed, store);
  return cards.length;
}

/** All stored cards, or only one deck's, oldest edit first. */
export async function listCards(deckId?: string): Promise<Card[]> {
  const all = (await keys(store)).filter((k): k is string => typeof k === 'string' && k.startsWith(CARD_PREFIX));
  const cards = (await getMany<Card>(all, store)).filter((c): c is Card => !!c && (deckId === undefined || c.deckId === deckId));
  return cards.sort((a, b) => a.updatedAt - b.updatedAt);
}

/**
 * The deck registry and the current deck id, creating the default deck and adopting any cards
 * saved before decks existed. Always returns at least one deck and a current id that exists.
 */
export async function loadDecks(): Promise<{ decks: DeckMeta[]; currentId: string }> {
  const stored = (await get<DeckMeta[]>(DECKS_KEY, store)) ?? [];
  const cards = await listCards();
  const { decks, stamped } = migrateLegacy(stored, cards);
  for (const c of stamped) await set(CARD_PREFIX + c.id, c, store);
  if (decks !== stored) await set(DECKS_KEY, decks, store);
  let currentId = await get<string>(CURRENT_DECK_KEY, store);
  if (!currentId || !decks.some((d) => d.id === currentId)) {
    currentId = decks[0].id;
    await set(CURRENT_DECK_KEY, currentId, store);
  }
  return { decks, currentId };
}

export function saveDecks(decks: DeckMeta[]): Promise<void> {
  return set(DECKS_KEY, decks, store);
}

export function saveCurrentDeck(id: string): Promise<void> {
  return set(CURRENT_DECK_KEY, id, store);
}

export function putCard(card: Card): Promise<void> {
  return set(CARD_PREFIX + card.id, card, store);
}

export function deleteCard(id: string): Promise<void> {
  return del(CARD_PREFIX + id, store);
}

export function putImage(key: string, blob: Blob): Promise<void> {
  return set(key, blob, store);
}

export function getImage(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, store);
}

export function deleteImage(key: string): Promise<void> {
  return del(key, store);
}

export function putUserFont(slot: 'title' | 'body', blob: Blob): Promise<void> {
  return set(FONT_PREFIX + slot, blob, store);
}

export function getUserFont(slot: 'title' | 'body'): Promise<Blob | undefined> {
  return get<Blob>(FONT_PREFIX + slot, store);
}

export function deleteUserFont(slot: 'title' | 'body'): Promise<void> {
  return del(FONT_PREFIX + slot, store);
}

export function newImageKey(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
  return `${IMAGE_PREFIX}${id}`;
}
