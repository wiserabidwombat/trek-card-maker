import { describe, it, expect } from 'vitest';
import { serializeDeck, parseDeck, DeckFormatError } from './deckJson';
import { newCard } from '../model/card';

describe('deck JSON', () => {
  it('round-trips cards and images', () => {
    const a = newCard('personnel', 'Set-001');
    a.fields.title = 'Worf';
    a.skills = [{ icon: 'skill-dot', text: 'Honor' }];
    a.image = { blobKey: 'img-1', crop: { x: 1, y: 2, w: 3, h: 4 }, srcW: 10, srcH: 20 };
    const b = newCard('event', 'Set-002');
    const json = serializeDeck([a, b], { 'img-1': 'data:image/png;base64,AAAA' });
    const parsed = parseDeck(json);
    expect(parsed.cards).toEqual([a, b]);
    expect(parsed.images).toEqual({ 'img-1': 'data:image/png;base64,AAAA' });
  });

  it('rejects malformed input', () => {
    expect(() => parseDeck('{}')).toThrow(DeckFormatError);
    expect(() => parseDeck('not json')).toThrow(DeckFormatError);
    expect(() => parseDeck(JSON.stringify({ version: 2, cards: [], images: {} }))).toThrow(/version/);
    expect(() => parseDeck(JSON.stringify({ version: 1, cards: [{ id: 1 }], images: {} }))).toThrow(DeckFormatError);
  });
});
