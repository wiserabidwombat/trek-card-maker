import type { Catalog } from '../catalog/types';
import { iconsInGroup } from '../catalog/types';
import type { Card } from '../model/card';
import { parseCollector } from '../model/collector';
import { KEYWORDS } from '../model/keywords';
import { lintCard, type LintContext, type LintMessage } from './lint';

/** Something that only shows when the cards are looked at together. */
export interface DeckIssue {
  text: string;
  level: 'warn' | 'info';
  /** The cards concerned, first one first. */
  cardIds: string[];
}

export interface CardIssues {
  card: Card;
  messages: LintMessage[];
}

export interface DeckLint {
  /** Cross-card findings. */
  deck: DeckIssue[];
  /** Per-card findings, only cards that have any, in deck order. */
  cards: CardIssues[];
  warnings: number;
  notes: number;
}

/** The lint context for a catalog: its skills, the keyword names and the inline icon ids. */
export function lintContext(catalog: Catalog): LintContext {
  return { skills: catalog.skills, keywords: KEYWORDS.map((k) => k.name), icons: iconsInGroup(catalog, 'inline').map((i) => i.id) };
}

/** A card's name for a message: its title, else the deck-list name, else "card n". */
export function cardLabel(card: Card, index: number): string {
  return (card.fields.title ?? '').trim() || card.name.trim() || `card ${index + 1}`;
}

function groups<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

export function lintDeck(cards: Card[], ctx: LintContext): DeckLint {
  const deck: DeckIssue[] = [];
  const label = (c: Card) => cardLabel(c, cards.indexOf(c));
  const names = (cs: Card[]) => cs.map(label).join(', ');

  for (const [, dupes] of groups(cards, (c) => (c.fields.collectorInfo ?? '').trim().replace(/\s+/g, ' ').toUpperCase())) {
    if (dupes.length > 1) {
      deck.push({ text: `Same collector number ${dupes[0].fields.collectorInfo.trim()} on ${dupes.length} cards: ${names(dupes)}.`, level: 'warn', cardIds: dupes.map((c) => c.id) });
    }
  }
  for (const [, dupes] of groups(cards, (c) => `${(c.fields.title ?? '').trim()}|${(c.fields.subtitle ?? '').trim()}`.toLowerCase().replace(/^\|$/, ''))) {
    if (dupes.length > 1) {
      deck.push({ text: `${dupes.length} cards share the title “${dupes[0].fields.title.trim()}”; use copies for duplicates, or give them different subtitles.`, level: 'warn', cardIds: dupes.map((c) => c.id) });
    }
  }

  const withCollector = cards.filter((c) => (c.fields.collectorInfo ?? '').trim());
  if (withCollector.length && withCollector.length < cards.length) {
    const missing = cards.filter((c) => !(c.fields.collectorInfo ?? '').trim());
    deck.push({ text: `Collector info is missing on ${missing.length} of ${cards.length} cards: ${names(missing)}.`, level: 'info', cardIds: missing.map((c) => c.id) });
  }
  const sets = new Set(withCollector.map((c) => parseCollector(c.fields.collectorInfo)?.set).filter(Boolean));
  if (sets.size > 1) {
    deck.push({ text: `Collector info names ${sets.size} different sets (${[...sets].join(', ')}).`, level: 'info', cardIds: withCollector.map((c) => c.id) });
  }
  const withCredit = cards.filter((c) => (c.fields.credit ?? '').trim());
  if (withCredit.length && withCredit.length < cards.length) {
    const missing = cards.filter((c) => !(c.fields.credit ?? '').trim());
    deck.push({ text: `The edge line is missing on ${missing.length} of ${cards.length} cards: ${names(missing)}.`, level: 'info', cardIds: missing.map((c) => c.id) });
  }
  const credits = new Set(withCredit.map((c) => c.fields.credit.trim()));
  if (credits.size > 1) {
    deck.push({ text: `${credits.size} different edge lines are in use.`, level: 'info', cardIds: withCredit.map((c) => c.id) });
  }

  const perCard: CardIssues[] = [];
  let warnings = deck.filter((d) => d.level === 'warn').length;
  let notes = deck.length - warnings;
  for (const card of cards) {
    const messages = lintCard(card, ctx);
    if (!messages.length) continue;
    perCard.push({ card, messages });
    warnings += messages.filter((m) => m.level === 'warn').length;
    notes += messages.filter((m) => m.level === 'info').length;
  }
  return { deck, cards: perCard, warnings, notes };
}
