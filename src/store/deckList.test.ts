import { describe, expect, it } from 'vitest';
import { newCard } from '../model/card';
import { buildDeckList, deckListFileName, deckListName } from './deckList';

function card(type: Parameters<typeof newCard>[0], title: string, copies = 1, extra: Record<string, string> = {}) {
  const c = newCard(type, `${type}.x`);
  c.fields = { ...c.fields, title, ...extra };
  c.copies = copies;
  return c;
}

describe('deck list', () => {
  it('names a card with its unique dot and subtitle, falling back to the deck-list name', () => {
    expect(deckListName(card('personnel', 'Worf', 1, { unique: '1', subtitle: 'Son of Mogh' }))).toBe('•Worf, Son of Mogh');
    const c = card('event', '');
    c.name = 'Draft event';
    expect(deckListName(c)).toBe('Draft event');
    c.name = '';
    expect(deckListName(c)).toBe('(untitled)');
  });

  it('groups missions, the dilemma pile and the draw deck by type, in deck order, with copy counts', () => {
    const cards = [
      card('personnel', 'Worf', 3, { unique: '1' }),
      card('mission', "Qo'noS", 1, { unique: '1', subtitle: 'Heart of the Empire' }),
      card('dilemma', 'Infatuation', 2),
      card('ship', 'I.K.S. Rotarran', 1),
      card('event', 'Unused', 0),
      card('personnel', 'Martok', 2),
    ];
    expect(buildDeckList(cards, 'Klingon honour')).toBe(
      [
        'Klingon honour',
        '',
        'Missions (1)',
        "1x •Qo'noS, Heart of the Empire",
        '',
        'Dilemma pile (2)',
        '2x Infatuation',
        '',
        'Draw deck (6)',
        'Personnel (5)',
        '3x •Worf',
        '2x Martok',
        'Ships (1)',
        '1x I.K.S. Rotarran',
        '',
      ].join('\n'),
    );
  });

  it('keeps the three sections even when empty', () => {
    expect(buildDeckList([], '')).toBe('Deck\n\nMissions (0)\n\nDilemma pile (0)\n\nDraw deck (0)\n');
  });

  it('names the file after the deck', () => {
    expect(deckListFileName('Klingon honour')).toBe('trek-deck-klingon-honour-list.txt');
    expect(deckListFileName('')).toBe('trek-deck-deck-list.txt');
  });
});
