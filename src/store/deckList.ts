import type { CardType } from '../catalog/types';
import type { Card } from '../model/card';
import { deckSlug } from './decks';

/**
 * A plain-text deck list the way players write them up: missions, the dilemma pile and the draw
 * deck, each card as "2x Title, Subtitle" in deck order, with the counts that deck registration
 * asks for. Cards with no copies are left out.
 */
const DRAW_DECK: { type: CardType; label: string }[] = [
  { type: 'personnel', label: 'Personnel' },
  { type: 'ship', label: 'Ships' },
  { type: 'equipment', label: 'Equipment' },
  { type: 'event', label: 'Events' },
  { type: 'interrupt', label: 'Interrupts' },
];

/** "•Qo'noS, Heart of the Empire": the unique dot, the title (else the deck-list name), the subtitle after a comma. */
export function deckListName(card: Card): string {
  const title = (card.fields.title ?? '').trim() || card.name.trim() || '(untitled)';
  const sub = (card.fields.subtitle ?? '').trim();
  return `${card.fields.unique === '1' ? '•' : ''}${title}${sub ? `, ${sub}` : ''}`;
}

function copiesOf(cards: Card[]): number {
  return cards.reduce((n, c) => n + Math.max(0, c.copies), 0);
}

function lines(cards: Card[]): string[] {
  return cards.map((c) => `${c.copies}x ${deckListName(c)}`);
}

export function buildDeckList(cards: Card[], deckName: string): string {
  const live = cards.filter((c) => c.copies > 0);
  const missions = live.filter((c) => c.type === 'mission');
  const dilemmas = live.filter((c) => c.type === 'dilemma');
  const draw = live.filter((c) => c.type !== 'mission' && c.type !== 'dilemma');
  const out: string[] = [deckName.trim() || 'Deck', ''];
  out.push(`Missions (${copiesOf(missions)})`, ...lines(missions), '');
  out.push(`Dilemma pile (${copiesOf(dilemmas)})`, ...lines(dilemmas), '');
  out.push(`Draw deck (${copiesOf(draw)})`);
  for (const { type, label } of DRAW_DECK) {
    const group = draw.filter((c) => c.type === type);
    if (!group.length) continue;
    out.push(`${label} (${copiesOf(group)})`, ...lines(group));
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

export function deckListFileName(deckName: string): string {
  return `trek-deck-${deckSlug(deckName) || 'deck'}-list.txt`;
}
