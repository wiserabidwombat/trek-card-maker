import type { CardType, Template } from '../catalog/types';
import type { Skill } from './skills';

export type { Skill } from './skills';

/** How many list icons a card of this type can carry: socket count, 5 for missions, else 0. */
export function maxIcons(type: CardType, template: Pick<Template, 'iconSlots'> | null | undefined): number {
  if (type === 'personnel' || type === 'ship') return template?.iconSlots?.length ?? 0;
  if (type === 'mission') return 5;
  return 0;
}

/** Icon ids a card may carry: Other Icons (personnel, ship) or affiliations (mission). */
export function iconsKeepAcross(from: CardType, to: CardType): boolean {
  const slotTypes: CardType[] = ['personnel', 'ship'];
  return slotTypes.includes(from) && slotTypes.includes(to);
}

/** Crop rectangle in source-image pixels. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardImage {
  blobKey: string;
  /** May extend past the picture when zoomed out; the rest of the art area shows `fill`. */
  crop: CropRect;
  srcW: number;
  srcH: number;
  /** CSS colour behind a zoomed-out picture; defaults to DEFAULT_ART_FILL. */
  fill?: string;
}

export const DEFAULT_ART_FILL = '#000000';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  frameId: string;
  fields: Record<string, string>;
  skills: Skill[];
  /** Other Icons (personnel, ship: big-*) or affiliation icons (mission: mission-*), in draw order. */
  icons: string[];
  image?: CardImage;
  copies: number;
  updatedAt: number;
  /** The deck this card belongs to; cards saved before decks existed get the default deck on load. */
  deckId?: string;
  /** Position in the deck list; cards without one are appended on load. */
  order?: number;
}

export interface FieldDef {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'multiline' | 'checkbox' | 'staffing' | 'quadrant' | 'collector';
  placeholder?: string;
}

/** The edge line most fan cards should carry; short enough to print at full size. */
export const DEFAULT_CREDIT = 'FAN-MADE CARD · NOT FOR SALE';

export const COMMON_FIELDS: FieldDef[] = [
  { id: 'title', label: 'Title', kind: 'text', placeholder: 'Card title' },
  { id: 'unique', label: 'Unique (•)', kind: 'checkbox' },
  { id: 'gameText', label: 'Game text', kind: 'multiline', placeholder: '**Keyword.** Game text with *italics* and {icon:klingon}' },
  { id: 'lore', label: 'Lore', kind: 'multiline', placeholder: '“Quote.”' },
  { id: 'collectorInfo', label: 'Collector info (set, rarity, number)', kind: 'collector', placeholder: '25 V 1' },
  { id: 'credit', label: 'Edge line (prints up the right edge)', kind: 'text', placeholder: DEFAULT_CREDIT },
];

export const FIELD_DEFS: Record<CardType, FieldDef[]> = {
  personnel: [
    { id: 'cost', label: 'Cost', kind: 'number' },
    { id: 'subtitle', label: 'Subtitle', kind: 'text' },
    { id: 'species', label: 'Species', kind: 'text', placeholder: 'Human' },
    { id: 'integrity', label: 'Integrity', kind: 'number' },
    { id: 'cunning', label: 'Cunning', kind: 'number' },
    { id: 'strength', label: 'Strength', kind: 'number' },
  ],
  ship: [
    { id: 'cost', label: 'Cost', kind: 'number' },
    { id: 'subtitle', label: 'Subtitle', kind: 'text' },
    { id: 'shipClass', label: 'Class', kind: 'text', placeholder: 'Galaxy Class' },
    { id: 'staffing', label: 'Staffing', kind: 'staffing' },
    { id: 'range', label: 'Range', kind: 'number' },
    { id: 'weapons', label: 'Weapons', kind: 'number' },
    { id: 'shields', label: 'Shields', kind: 'number' },
  ],
  equipment: [{ id: 'cost', label: 'Cost', kind: 'number' }],
  event: [{ id: 'cost', label: 'Cost', kind: 'number' }],
  dilemma: [{ id: 'cost', label: 'Cost', kind: 'number' }],
  interrupt: [],
  mission: [
    { id: 'subtitle', label: 'Subtitle', kind: 'text' },
    { id: 'quadrant', label: 'Quadrant', kind: 'quadrant' },
    { id: 'points', label: 'Points', kind: 'number' },
    { id: 'span', label: 'Span', kind: 'number' },
    { id: 'requirements', label: 'Requirements', kind: 'multiline', placeholder: 'Diplomacy, Leadership, and Cunning>30' },
    { id: 'hqLabel', label: 'Headquarters label (replaces the affiliation icons in the bottom strip)', kind: 'text', placeholder: 'Borg Headquarters' },
  ],
};

export const ATTRIBUTE_FIELDS: Partial<Record<CardType, [string, string, string]>> = {
  personnel: ['integrity', 'cunning', 'strength'],
  ship: ['range', 'weapons', 'shields'],
};

export function fieldsFor(type: CardType): FieldDef[] {
  return [...COMMON_FIELDS, ...FIELD_DEFS[type]];
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyFields(type: CardType): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fieldsFor(type)) out[f.id] = '';
  return out;
}

export function newCard(type: CardType, frameId: string, deckId?: string): Card {
  return {
    id: uid(),
    name: '',
    type,
    frameId,
    fields: emptyFields(type),
    skills: [],
    icons: [],
    copies: 1,
    updatedAt: Date.now(),
    ...(deckId ? { deckId } : {}),
  };
}

export function changeType(card: Card, type: CardType, frameId: string): Card {
  const fields = emptyFields(type);
  for (const f of COMMON_FIELDS) fields[f.id] = card.fields[f.id] ?? '';
  // Keep values for fields both types share (e.g. cost, subtitle).
  for (const f of FIELD_DEFS[type]) if (card.fields[f.id] !== undefined) fields[f.id] = card.fields[f.id];
  return {
    ...card,
    type,
    frameId,
    fields,
    skills: type === 'personnel' ? card.skills : [],
    icons: iconsKeepAcross(card.type, type) ? card.icons : [],
    updatedAt: Date.now(),
  };
}

export function typeBarText(card: Card): string {
  switch (card.type) {
    case 'personnel':
      return card.fields.species ?? '';
    case 'ship':
      return card.fields.shipClass ?? '';
    case 'mission':
      return '';
    default:
      return card.type.charAt(0).toUpperCase() + card.type.slice(1);
  }
}

export function displayTitle(card: Card): string {
  const t = card.fields.title ?? '';
  return card.fields.unique === '1' ? `•${t}` : t;
}

/** Quadrant letters as printed on mission cards. */
export const QUADRANTS: Record<string, string> = { A: 'Α', B: 'Β', G: 'Γ', D: 'Δ' };

/** Staffing is stored as a comma-separated list of icon ids. */
export function staffingIcons(card: Card): string[] {
  return (card.fields.staffing ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True for a card nobody has touched yet: no name, artwork, skills or icons, and every text field empty. */
export function isBlankCard(card: Card): boolean {
  if (card.name.trim() || card.image || card.skills.length || card.icons.length) return false;
  return Object.values(card.fields).every((v) => !v.trim());
}
