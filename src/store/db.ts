import { createStore, get, set, del, keys, getMany, delMany } from 'idb-keyval';
import type { Card } from '../model/card';

const store = createStore('trek-card-maker', 'kv');

const CARD_PREFIX = 'card:';
const FONT_PREFIX = 'font:';
const IMAGE_PREFIX = 'img-';

/** Keys that belong to cards and their images; fonts and anything else are left alone. */
export function isCardOrImageKey(key: unknown): key is string {
  return typeof key === 'string' && (key.startsWith(CARD_PREFIX) || key.startsWith(IMAGE_PREFIX));
}

/** Remove every stored card and image. Returns how many cards were removed. */
export async function clearCardsAndImages(): Promise<number> {
  const all = await keys(store);
  const doomed = all.filter(isCardOrImageKey);
  await delMany(doomed, store);
  return doomed.filter((k) => k.startsWith(CARD_PREFIX)).length;
}

export async function listCards(): Promise<Card[]> {
  const all = (await keys(store)).filter((k): k is string => typeof k === 'string' && k.startsWith(CARD_PREFIX));
  const cards = (await getMany<Card>(all, store)).filter((c): c is Card => !!c);
  return cards.sort((a, b) => a.updatedAt - b.updatedAt);
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
