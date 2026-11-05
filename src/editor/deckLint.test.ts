import { describe, expect, it } from 'vitest';
import { newCard } from '../model/card';
import { STANDARD_SKILLS } from '../model/skills';
import { cardLabel, lintDeck } from './deckLint';

const ctx = { skills: STANDARD_SKILLS, keywords: ['Admiral'], icons: ['klingon'] };

function personnel(title: string, fields: Record<string, string> = {}) {
  const c = newCard('personnel', 'personnel.klingon');
  c.fields = { ...c.fields, title, cost: '3', integrity: '6', cunning: '5', strength: '8', species: 'Klingon', gameText: 'Draw a card.', ...fields };
  return c;
}

describe('lintDeck', () => {
  it('is quiet for a consistent deck', () => {
    const cards = [personnel('Worf', { collectorInfo: '1 C 1', credit: 'x' }), personnel('Martok', { collectorInfo: '1 C 2', credit: 'x' })];
    const r = lintDeck(cards, ctx);
    expect(r.deck).toEqual([]);
    expect(r.cards).toEqual([]);
    expect(r.warnings + r.notes).toBe(0);
  });

  it('flags duplicate collector numbers and titles', () => {
    const a = personnel('Worf', { collectorInfo: '1 C 1' });
    const b = personnel('Worf', { collectorInfo: '1 c  1' });
    const r = lintDeck([a, b], ctx);
    expect(r.deck.map((d) => d.text)).toEqual([
      'Same collector number 1 C 1 on 2 cards: Worf, Worf.',
      '2 cards share the title “Worf”; use copies for duplicates, or give them different subtitles.',
    ]);
    expect(r.deck[0].cardIds).toEqual([a.id, b.id]);
    expect(r.warnings).toBe(2);
  });

  it('does not treat different subtitles as duplicates', () => {
    const r = lintDeck([personnel('Worf', { subtitle: 'Son of Mogh' }), personnel('Worf', { subtitle: 'Ambassador' })], ctx);
    expect(r.deck).toEqual([]);
  });

  it('notes partial collector info, mixed sets and edge lines', () => {
    const cards = [
      personnel('A', { collectorInfo: '1 C 1', credit: 'one' }),
      personnel('B', { collectorInfo: '2 C 1', credit: 'two' }),
      personnel('C'),
    ];
    const r = lintDeck(cards, ctx);
    expect(r.deck.map((d) => [d.level, d.text])).toEqual([
      ['info', 'Collector info is missing on 1 of 3 cards: C.'],
      ['info', 'Collector info names 2 different sets (1, 2).'],
      ['info', 'The edge line is missing on 1 of 3 cards: C.'],
      ['info', '2 different edge lines are in use.'],
    ]);
    expect(r.notes).toBe(4);
  });

  it('collects per-card messages for the cards that have any', () => {
    const bad = personnel('Bad', { gameText: 'no period' });
    const r = lintDeck([personnel('Good'), bad], ctx);
    expect(r.cards.map((c) => c.card.id)).toEqual([bad.id]);
    expect(r.cards[0].messages.map((m) => m.text)).toEqual(['Game text starts with a lowercase letter.', 'Game text should end with a period.']);
    expect(r.warnings).toBe(2);
  });

  it('labels cards by title, then name, then position', () => {
    const c = newCard('event', 'event.default');
    expect(cardLabel(c, 4)).toBe('card 5');
    c.name = 'Draft';
    expect(cardLabel(c, 4)).toBe('Draft');
    c.fields.title = 'Red Alert';
    expect(cardLabel(c, 4)).toBe('Red Alert');
  });
});
