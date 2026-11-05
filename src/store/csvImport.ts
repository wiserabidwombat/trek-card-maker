import { CARD_TYPES, type Catalog, type CardType, type Frame } from '../catalog/types';
import { DEFAULT_CREDIT, fieldsFor, newCard, type Card } from '../model/card';
import { formatCollector } from '../model/collector';
import { parseSkillText } from '../model/skills';

/**
 * Split CSV or TSV text into rows. The delimiter is read off the header line (tab when it has
 * tabs and no commas, semicolon when semicolons outnumber commas, else comma); quotes, doubled
 * quotes and newlines inside quotes follow RFC 4180. Blank rows are dropped.
 */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = first.includes('\t') && !first.includes(',') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Header names people are likely to type, mapped to card fields (letters only, lower case). */
const COLUMNS: Record<string, string> = {
  type: 'type',
  cardtype: 'type',
  frame: 'frame',
  affiliation: 'frame',
  variant: 'frame',
  name: 'name',
  title: 'title',
  unique: 'unique',
  subtitle: 'subtitle',
  species: 'species',
  class: 'shipClass',
  shipclass: 'shipClass',
  staffing: 'staffing',
  cost: 'cost',
  integrity: 'integrity',
  cunning: 'cunning',
  strength: 'strength',
  range: 'range',
  weapons: 'weapons',
  shields: 'shields',
  skills: 'skills',
  icons: 'icons',
  othericons: 'icons',
  affiliations: 'icons',
  quadrant: 'quadrant',
  points: 'points',
  span: 'span',
  requirements: 'requirements',
  hq: 'hqLabel',
  hqlabel: 'hqLabel',
  headquarters: 'hqLabel',
  gametext: 'gameText',
  text: 'gameText',
  lore: 'lore',
  collector: 'collectorInfo',
  collectorinfo: 'collectorInfo',
  set: 'set',
  setnumber: 'set',
  rarity: 'rarity',
  number: 'number',
  cardnumber: 'number',
  credit: 'credit',
  edge: 'credit',
  edgeline: 'credit',
  copies: 'copies',
};

const normHeader = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');
const slug = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-');
const list = (v: string) => v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
const TRUE = new Set(['1', 'y', 'yes', 'true', 'x', '•', 'unique']);

/** The frame a row asks for: by id, "type.variant", variant, label or affiliation; else the first frame of the type. */
export function resolveFrame(catalog: Catalog, type: CardType, value: string): { frame: Frame; matched: boolean } {
  const ofType = catalog.frames.filter((f) => f.type === type);
  const v = value.trim().toLowerCase();
  const s = slug(value);
  const hit = v
    ? ofType.find((f) => f.id === v || f.id === `${type}.${s}` || f.variant.toLowerCase() === s || f.label.toLowerCase() === v || f.affiliation === s)
    : undefined;
  if (hit) return { frame: hit, matched: true };
  const fallback = ofType.find((f) => f.family === 'hires') ?? ofType[0];
  if (!fallback) throw new Error(`The catalog has no ${type} frame`);
  return { frame: fallback, matched: !v };
}

/** An icon id from an id or a short name: "command" → big-command on personnel, "Klingon" → mission-klingon on missions. */
export function resolveIcon(catalog: Catalog, type: CardType, value: string): string | null {
  const s = slug(value);
  // only icons a card of this type can carry: "klingon" alone is the inline icon, not a mission affiliation
  const group = type === 'mission' ? 'missionAffiliation' : 'other';
  const prefix = type === 'mission' ? 'mission-' : 'big-';
  for (const id of [prefix + s, s]) if (catalog.icons.some((i) => i.id === id && i.group === group)) return id;
  return null;
}

export interface CsvImport {
  cards: Card[];
  warnings: string[];
}

/** Turn parsed rows (header first) into cards. Rows with an unknown type are skipped with a warning. */
export function cardsFromRows(rows: string[][], catalog: Catalog, deckId?: string): CsvImport {
  if (rows.length < 2) throw new Error('The file needs a header row and at least one card row.');
  const header = rows[0];
  const cols = header.map((h) => COLUMNS[normHeader(h)]);
  const warnings: string[] = [];
  const ignored = header.filter((h, i) => !cols[i] && h.trim());
  if (ignored.length) warnings.push(`Ignored column${ignored.length === 1 ? '' : 's'}: ${ignored.join(', ')}.`);
  if (!cols.includes('type')) warnings.push('No type column: every row became a personnel card.');
  if (!cols.includes('title') && !cols.includes('name')) throw new Error('The header needs a title (or name) column.');

  const cards: Card[] = [];
  rows.slice(1).forEach((row, r) => {
    const line = r + 2;
    const get = (key: string): string => {
      const i = cols.indexOf(key);
      return i < 0 ? '' : (row[i] ?? '').trim();
    };
    const typeRaw = get('type').toLowerCase();
    const type = (typeRaw || 'personnel') as CardType;
    if (!CARD_TYPES.includes(type)) {
      warnings.push(`Row ${line}: unknown type "${get('type')}", skipped.`);
      return;
    }
    const frameValue = get('frame');
    const { frame, matched } = resolveFrame(catalog, type, frameValue);
    if (!matched) warnings.push(`Row ${line}: no ${type} frame called "${frameValue}", used ${frame.label}.`);

    const card = newCard(type, frame.id, deckId);
    card.name = get('name') || get('title');
    for (const f of fieldsFor(type)) {
      if (!cols.includes(f.id)) continue;
      const v = get(f.id);
      if (f.id === 'unique') card.fields.unique = TRUE.has(v.toLowerCase()) ? '1' : '';
      else if (f.id === 'staffing') {
        card.fields.staffing = list(v)
          .map((s) => (/^c/i.test(s) ? 'command' : /^s/i.test(s) ? 'staff' : ''))
          .filter(Boolean)
          .join(',');
      } else if (f.id === 'quadrant') card.fields.quadrant = v.charAt(0).toUpperCase();
      else card.fields[f.id] = v;
    }
    // set, rarity and number columns build the collector info when the row has no collector column
    if (!card.fields.collectorInfo && ['set', 'rarity', 'number'].some((k) => cols.includes(k))) {
      card.fields.collectorInfo = formatCollector({ set: get('set'), rarity: get('rarity'), number: get('number') });
    }
    if (type === 'personnel' && cols.includes('skills')) card.skills = list(get('skills')).map(parseSkillText);
    if (cols.includes('icons')) {
      for (const raw of list(get('icons'))) {
        const id = resolveIcon(catalog, type, raw);
        if (id) card.icons.push(id);
        else warnings.push(`Row ${line}: no icon called "${raw}".`);
      }
    }
    if (cols.includes('copies')) {
      const n = Number.parseInt(get('copies'), 10);
      card.copies = Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 1;
    }
    cards.push(card);
  });
  return { cards, warnings };
}

/** A header row with every column the importer knows, and one card of each main type as examples. */
export function csvTemplate(): string {
  const header = ['type', 'frame', 'title', 'unique', 'subtitle', 'species', 'class', 'cost', 'integrity', 'cunning', 'strength', 'range', 'weapons', 'shields', 'staffing', 'skills', 'icons', 'quadrant', 'points', 'span', 'requirements', 'hq', 'game text', 'lore', 'set', 'rarity', 'number', 'credit', 'copies'];
  const rows = [
    ['personnel', 'Klingon', 'Worf', 'yes', 'Son of Mogh', 'Klingon', '', '3', '6', '6', '8', '', '', '', '', '2 Leadership, Honor, Security', 'command', '', '', '', '', '', '**Order** - Stop this personnel to make another {icon:klingon} personnel present Strength +3 until the end of this turn.', '"Today is a good day to die."', '1', 'R', '1', DEFAULT_CREDIT, '2'],
    ['ship', 'Klingon', 'I.K.S. Rotarran', 'yes', '', '', "B'rel Class", '5', '', '', '', '8', '7', '7', 'command, staff', '', 'command', '', '', '', '', '', '**Cloaking Device.**', '', '1', 'R', '2', DEFAULT_CREDIT, '1'],
    ['mission', 'Planet', "Qo'noS", '', 'Secure Homeworld', '', '', '', '', '', '', '', '', '', '', '', 'Klingon', 'Alpha', '35', '2', 'Diplomacy, Honor, 2 Leadership, and Strength>34', '', 'When you complete this mission, you may download a {icon:klingon} ship.', '"The Klingon homeworld."', '1', 'U', '3', DEFAULT_CREDIT, '1'],
  ];
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
