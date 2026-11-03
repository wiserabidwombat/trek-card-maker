import type { CardType } from '../catalog/types';

export interface Skill {
  icon: string;
  text: string;
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
  crop: CropRect;
  srcW: number;
  srcH: number;
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  frameId: string;
  fields: Record<string, string>;
  skills: Skill[];
  image?: CardImage;
  copies: number;
  updatedAt: number;
}

export interface FieldDef {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'multiline' | 'checkbox' | 'staffing' | 'quadrant';
  placeholder?: string;
}

export const COMMON_FIELDS: FieldDef[] = [
  { id: 'title', label: 'Title', kind: 'text', placeholder: 'Card title' },
  { id: 'unique', label: 'Unique (•)', kind: 'checkbox' },
  { id: 'gameText', label: 'Game text', kind: 'multiline', placeholder: '**Keyword.** Game text with *italics* and {icon:klingon}' },
  { id: 'lore', label: 'Lore', kind: 'multiline', placeholder: '“Quote.”' },
  { id: 'collectorInfo', label: 'Collector info', kind: 'text', placeholder: '1 C 1' },
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

export function newCard(type: CardType, frameId: string): Card {
  return {
    id: uid(),
    name: '',
    type,
    frameId,
    fields: emptyFields(type),
    skills: [],
    copies: 1,
    updatedAt: Date.now(),
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
