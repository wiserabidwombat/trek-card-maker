import type { Card } from '../model/card';
import { parseSkillText } from '../model/skills';
import { CARD_TYPES, type Catalog } from '../catalog/types';

export class DeckFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckFormatError';
  }
}

export const DECK_VERSION = 2;

export interface DeckFile {
  version: typeof DECK_VERSION;
  exportedAt: string;
  cards: Card[];
  images: Record<string, string>; // blobKey -> data URL
}

export function serializeDeck(cards: Card[], images: Record<string, string>): string {
  const file: DeckFile = { version: DECK_VERSION, exportedAt: new Date().toISOString(), cards, images };
  return JSON.stringify(file, null, 1);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkSkills(raw: unknown): Card['skills'] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((s) => {
    if (typeof s.name === 'string') return { name: s.name, count: Math.max(1, Number(s.count) || 1) };
    return parseSkillText(String(s.text ?? '')); // version 1: { icon, text }
  });
}

function checkCard(i: number, c: unknown): Card {
  if (!isRecord(c)) throw new DeckFormatError(`cards[${i}] is not an object`);
  if (typeof c.id !== 'string' || typeof c.frameId !== 'string') throw new DeckFormatError(`cards[${i}] needs id and frameId`);
  if (typeof c.type !== 'string' || !(CARD_TYPES as string[]).includes(c.type)) throw new DeckFormatError(`cards[${i}] has an unknown type`);
  if (!isRecord(c.fields)) throw new DeckFormatError(`cards[${i}].fields must be an object`);
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.fields)) fields[k] = typeof v === 'string' ? v : String(v ?? '');
  const skills = checkSkills(c.skills);
  const icons = Array.isArray(c.icons) ? c.icons.filter((x): x is string => typeof x === 'string') : [];
  let image: Card['image'];
  if (isRecord(c.image) && typeof c.image.blobKey === 'string' && isRecord(c.image.crop)) {
    const cr = c.image.crop;
    image = {
      blobKey: c.image.blobKey,
      crop: { x: Number(cr.x), y: Number(cr.y), w: Number(cr.w), h: Number(cr.h) },
      srcW: Number(c.image.srcW),
      srcH: Number(c.image.srcH),
    };
  }
  return {
    id: c.id,
    name: typeof c.name === 'string' ? c.name : '',
    type: c.type as Card['type'],
    frameId: c.frameId,
    fields,
    skills,
    icons,
    ...(image ? { image } : {}),
    copies: Number.isFinite(Number(c.copies)) ? Number(c.copies) : 1,
    updatedAt: Number(c.updatedAt) || Date.now(),
  };
}

export function parseDeck(json: string): { cards: Card[]; images: Record<string, string> } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new DeckFormatError('File is not valid JSON');
  }
  if (!isRecord(data)) throw new DeckFormatError('Deck file must be a JSON object');
  if (data.version !== 1 && data.version !== DECK_VERSION) throw new DeckFormatError(`Unsupported deck file version: ${String(data.version)}`);
  if (!Array.isArray(data.cards)) throw new DeckFormatError('Deck file has no cards array');
  const cards = data.cards.map((c, i) => checkCard(i, c));
  const images: Record<string, string> = {};
  if (isRecord(data.images)) {
    for (const [k, v] of Object.entries(data.images)) if (typeof v === 'string') images[k] = v;
  }
  return { cards, images };
}

/**
 * Point cards whose frame no longer exists at the first base frame of their type.
 * Returns the remapped cards and how many changed.
 */
export function remapFrames(cards: Card[], catalog: Catalog): { cards: Card[]; remapped: number } {
  const known = new Set(catalog.frames.map((f) => f.id));
  let remapped = 0;
  const out = cards.map((c) => {
    if (known.has(c.frameId)) return c;
    const fallback = catalog.frames.find((f) => f.type === c.type) ?? catalog.frames[0];
    if (!fallback) return c;
    remapped++;
    return { ...c, frameId: fallback.id, updatedAt: Date.now() };
  });
  return { cards: out, remapped };
}
