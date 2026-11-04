import { describe, it, expect } from 'vitest';
import { DEFAULT_DECK_ID, deckFileName, importedDeckName, migrateLegacy, uniqueDeckName, type DeckMeta } from './decks';
import { newCard } from '../model/card';

const deck = (id: string, name: string): DeckMeta => ({ id, name, createdAt: 1 });

describe('deck migration', () => {
  it('creates the default deck and stamps cards that predate decks', () => {
    const legacy = newCard('personnel', 'personnel.klingon');
    const { decks, stamped } = migrateLegacy([], [legacy], 5);
    expect(decks).toEqual([{ id: DEFAULT_DECK_ID, name: 'My deck', createdAt: 5 }]);
    expect(stamped).toEqual([{ ...legacy, deckId: DEFAULT_DECK_ID }]);
  });

  it('leaves an existing registry and stamped cards alone', () => {
    const mine = deck('abc', 'Mine');
    const card = { ...newCard('ship', 'ship.federation'), deckId: 'abc' };
    expect(migrateLegacy([mine], [card])).toEqual({ decks: [mine], stamped: [] });
  });

  it('re-adds the default deck if orphans appear after it was deleted', () => {
    const { decks, stamped } = migrateLegacy([deck('abc', 'Mine')], [newCard('event', 'event.default')], 9);
    expect(decks.map((d) => d.id)).toEqual(['abc', DEFAULT_DECK_ID]);
    expect(stamped[0].deckId).toBe(DEFAULT_DECK_ID);
  });
});

describe('deck names', () => {
  it('numbers duplicates case-insensitively', () => {
    const existing = [deck('1', 'Klingons'), deck('2', 'Klingons 2')];
    expect(uniqueDeckName('klingons', existing)).toBe('klingons 3');
    expect(uniqueDeckName('Borg', existing)).toBe('Borg');
    expect(uniqueDeckName('   ', existing)).toBe('Deck');
  });

  it('slugs file names', () => {
    expect(deckFileName('Klingon Aggro!')).toBe('trek-deck-klingon-aggro.json');
    expect(deckFileName('   ')).toBe('trek-deck-deck.json');
  });

  it('names imports from the embedded name, else the file name', () => {
    expect(importedDeckName('trek-deck-borg-swarm.json', undefined, [])).toBe('borg swarm');
    expect(importedDeckName('whatever.json', 'Borg Swarm', [deck('1', 'Borg Swarm')])).toBe('Borg Swarm 2');
    expect(importedDeckName('.json', '', [])).toBe('Imported deck');
  });
});
