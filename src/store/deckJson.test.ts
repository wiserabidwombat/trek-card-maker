import { describe, it, expect } from 'vitest';
import { serializeDeck, parseDeck, remapFrames, DeckFormatError } from './deckJson';
import { newCard } from '../model/card';
import type { Catalog } from '../catalog/types';

describe('deck JSON', () => {
  it('round-trips cards and images as version 2', () => {
    const a = newCard('personnel', 'personnel.federation');
    a.fields.title = 'Worf';
    a.skills = [{ name: 'Honor', count: 1 }, { name: 'Leadership', count: 2 }];
    a.icons = ['big-staff', 'big-earth'];
    a.image = { blobKey: 'img-1', crop: { x: 1, y: 2, w: 3, h: 4 }, srcW: 10, srcH: 20 };
    const b = newCard('event', 'event.default');
    const json = serializeDeck([a, b], { 'img-1': 'data:image/png;base64,AAAA' });
    expect(JSON.parse(json).version).toBe(2);
    const parsed = parseDeck(json);
    expect(parsed.cards).toEqual([a, b]);
    expect(parsed.images).toEqual({ 'img-1': 'data:image/png;base64,AAAA' });
  });

  it('migrates version 1 skills and defaults icons', () => {
    const v1 = {
      version: 1,
      cards: [
        {
          id: 'x',
          name: '',
          type: 'personnel',
          frameId: 'Caretaker-035',
          fields: { title: 'Alex' },
          skills: [{ icon: 'skill-dot', text: '2 Honor' }, { icon: 'skill-dot', text: 'Chef' }],
          copies: 1,
          updatedAt: 1,
        },
      ],
      images: {},
    };
    const { cards } = parseDeck(JSON.stringify(v1));
    expect(cards[0].skills).toEqual([{ name: 'Honor', count: 2 }, { name: 'Chef', count: 1 }]);
    expect(cards[0].icons).toEqual([]);
    expect(cards[0].frameId).toBe('Caretaker-035');
  });

  it('remaps unknown frames to the first base frame of the type', () => {
    const catalog = {
      frames: [
        { id: 'event.default', type: 'event' },
        { id: 'personnel.federation', type: 'personnel' },
        { id: 'personnel.klingon', type: 'personnel' },
      ],
    } as unknown as Catalog;
    const old = newCard('personnel', 'Caretaker-035');
    const fine = newCard('personnel', 'personnel.klingon');
    const { cards, remapped } = remapFrames([old, fine], catalog);
    expect(remapped).toBe(1);
    expect(cards[0].frameId).toBe('personnel.federation');
    expect(cards[1]).toBe(fine);
  });

  it('rejects malformed input', () => {
    expect(() => parseDeck('{}')).toThrow(DeckFormatError);
    expect(() => parseDeck('not json')).toThrow(DeckFormatError);
    expect(() => parseDeck(JSON.stringify({ version: 3, cards: [], images: {} }))).toThrow(/version/);
    expect(() => parseDeck(JSON.stringify({ version: 1, cards: [{ id: 1 }], images: {} }))).toThrow(DeckFormatError);
  });
});
