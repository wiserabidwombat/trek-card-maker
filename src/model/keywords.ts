import type { CardType } from '../catalog/types';

/**
 * Keywords the Second Edition cards print in bold at the start of the game text, each followed by a
 * period: "Assault. Maneuver. Plays in your core." Keywords with a value keep the value inside the
 * bold: "Commander: U.S.S. Defiant." The list was read off the printed cards in the TrekCC sets the
 * frames come from, plus a few from the Decipher sets that use the same form.
 */
export interface KeywordDef {
  name: string;
  /** Card types that carry it; the picker shows a type only its own keywords. */
  types: CardType[];
  /** A value follows a colon: a ship name, a number, a place. */
  value?: 'ship' | 'number' | 'place';
}

const P: CardType[] = ['personnel'];
const E: CardType[] = ['event'];
const EI: CardType[] = ['event', 'interrupt'];
const EQ: CardType[] = ['equipment', 'event'];

export const KEYWORDS: readonly KeywordDef[] = [
  // personnel
  { name: 'Admiral', types: P },
  { name: 'Android', types: P },
  { name: 'Assassin', types: P },
  { name: 'Augment', types: P },
  { name: 'Bajoran Resistance', types: P },
  { name: 'Cadet', types: P },
  { name: 'Chancellor', types: P },
  { name: 'Commander', types: P, value: 'ship' },
  { name: 'Dissident', types: P },
  { name: 'Drone', types: P },
  { name: 'General', types: P },
  { name: 'Glinn', types: P },
  { name: 'Hologram', types: P },
  { name: 'Host', types: P },
  { name: 'Infiltrator', types: P },
  { name: 'Kai', types: P },
  { name: 'Legate', types: P },
  { name: 'MACO', types: P },
  { name: 'Pah-wraith', types: P },
  { name: 'Praetor', types: P },
  { name: 'Prophet', types: P },
  { name: 'Senator', types: P },
  { name: 'Shape-shifter', types: P },
  { name: 'Smuggler', types: P },
  { name: 'Thief', types: P },
  { name: 'Vedek', types: P },
  // ships
  { name: 'Cloaking Device', types: ['ship'] },
  // equipment and events
  { name: 'Artifact', types: EQ },
  { name: 'Commodity', types: EQ },
  { name: 'Hand Weapon', types: EQ },
  // events and interrupts
  { name: 'Assault', types: EI },
  { name: 'Crime', types: E },
  { name: 'Decay', types: E, value: 'number' },
  { name: 'Holoprogram', types: E },
  { name: 'Interlink', types: E, value: 'number' },
  { name: 'Maneuver', types: EI },
  { name: 'Mirror', types: EI },
  { name: 'Paranoia', types: E },
  { name: 'Pursuit', types: E },
  { name: 'Q', types: EI },
  { name: 'Recall', types: E, value: 'number' },
  { name: 'Ritual', types: E },
  { name: 'Temporal', types: EI },
  // missions
  { name: 'Nebula', types: ['mission'] },
  { name: 'Region', types: ['mission'], value: 'place' },
  // dilemmas
  { name: 'Consume', types: ['dilemma'], value: 'number' },
];

export function keywordsFor(type: CardType): KeywordDef[] {
  return KEYWORDS.filter((k) => k.types.includes(type));
}

/** Markup to insert for a keyword, and where the caret belongs afterwards (inside the bold for a value). */
export function keywordInsert(k: KeywordDef): { text: string; caret: number } {
  if (k.value) {
    const text = `**${k.name}: .** `;
    return { text, caret: text.indexOf('.**') };
  }
  const text = `**${k.name}.** `;
  return { text, caret: text.length };
}

/** The printed form of a keyword with its value filled in, for tests and the Help text. */
export function keywordText(k: KeywordDef, value = ''): string {
  return k.value ? `**${k.name}: ${value}.** ` : `**${k.name}.** `;
}
