import type { CardType } from '../catalog/types';
import type { Card } from '../model/card';
import { parseMarkup } from '../model/markup';

/**
 * Checks a card against the way Second Edition cards are written, so a custom card does not give
 * itself away by its text. Everything here is advice: nothing blocks saving or exporting.
 */
export interface LintMessage {
  /** Field id the message is about (focusable with document.getElementById), or '' for the card as a whole. */
  field: string;
  text: string;
  /** warn: the card will look wrong; info: a convention worth following. */
  level: 'warn' | 'info';
}

export interface LintContext {
  /** Standard skill names, as printed. */
  skills: readonly string[];
  /** Keywords the cards print in bold, as printed (without colon values). */
  keywords: readonly string[];
  /** Inline icon ids that {icon:…} may use. */
  icons: readonly string[];
}

const ATTRIBUTES = ['Integrity', 'Cunning', 'Strength', 'Range', 'Weapons', 'Shields'];

const NUMBERS: Partial<Record<CardType, string[]>> = {
  personnel: ['cost', 'integrity', 'cunning', 'strength'],
  ship: ['cost', 'range', 'weapons', 'shields'],
  mission: ['points', 'span'],
  dilemma: ['cost'],
  event: ['cost'],
  equipment: ['cost'],
};

const LABELS: Record<string, string> = {
  cost: 'Cost',
  integrity: 'Integrity',
  cunning: 'Cunning',
  strength: 'Strength',
  range: 'Range',
  weapons: 'Weapons',
  shields: 'Shields',
  points: 'Points',
  span: 'Span',
  gameText: 'Game text',
  lore: 'Lore',
  requirements: 'Requirements',
};

/** The text as it will print, markup and icons removed. */
export function plainText(src: string): string {
  return parseMarkup(src)
    .map((r) => (r.kind === 'text' ? r.text : r.kind === 'break' ? '\n' : '⁠'))
    .join('')
    .trim();
}

/** Levenshtein distance, for "did you mean" suggestions. */
export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** A standard skill within two edits of `word` (case-insensitive), unless the word already is one. */
export function nearestSkill(word: string, skills: readonly string[]): string | null {
  if (skills.includes(word)) return null;
  const lower = word.toLowerCase();
  let best: string | null = null;
  let bestD = 3;
  for (const s of skills) {
    const d = editDistance(lower, s.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function lintCard(card: Card, ctx: LintContext): LintMessage[] {
  const out: LintMessage[] = [];
  const f = card.fields;
  const warn = (field: string, text: string) => out.push({ field, text, level: 'warn' });
  const info = (field: string, text: string) => out.push({ field, text, level: 'info' });

  if (!(f.title ?? '').trim()) warn('title', 'The title is empty.');

  const missing = (NUMBERS[card.type] ?? []).filter((id) => !(f[id] ?? '').trim());
  if (missing.length) info(missing[0], `Not filled in: ${missing.map((id) => LABELS[id]).join(', ')}.`);

  if (card.type === 'personnel' && !(f.species ?? '').trim()) info('species', 'Species is empty; every personnel names one.');
  if (card.type === 'ship' && !(f.shipClass ?? '').trim()) info('shipClass', 'Class is empty; every ship names one.');
  if (card.type === 'mission' && !(f.requirements ?? '').trim()) warn('requirements', 'Mission requirements are empty.');

  // the three marked-up fields
  for (const id of ['gameText', 'lore', 'requirements'] as const) {
    const raw = f[id] ?? '';
    if (!raw.trim()) continue;
    const label = LABELS[id];

    const stars = (raw.match(/\*\*/g) ?? []).length;
    if (stars % 2) warn(id, `${label}: a ** bold marker has no partner.`);
    for (const m of raw.matchAll(/\{icon:([^}]*)\}/g)) {
      if (!ctx.icons.includes(m[1])) warn(id, `${label}: no icon called “${m[1]}”.`);
    }
    if (/\{(?!icon:)[^}]*\}/.test(raw)) warn(id, `${label}: braces only make sense as {icon:id}.`);

    const text = plainText(raw);
    if (/  /.test(text)) info(id, `${label}: double space.`);

    for (const m of text.matchAll(new RegExp(`\\b(${ATTRIBUTES.join('|')})\\s*([<>])\\s*(\\d+)`, 'g'))) {
      if (/\s/.test(m[0])) {
        warn(id, `${label}: attribute comparisons print without spaces, ${m[1]}${m[2]}${m[3]}.`);
        break;
      }
    }

    if (id === 'gameText') {
      if (/^\p{Ll}/u.test(text)) warn(id, 'Game text starts with a lowercase letter.');
      if (!/[.!?”"’)\]]$/.test(text) && !/\{icon:[^}]*\}\s*$/.test(raw)) warn(id, 'Game text should end with a period.');
      for (const m of raw.matchAll(/(^|\n)\s*(Order|Interrupt)\s*[–-]/g)) {
        if (!raw.slice(0, m.index).endsWith('**')) {
          info(id, `${m[2]} prints in bold: **${m[2]}** –`);
          break;
        }
      }
      if (/\b(Order|Interrupt):/.test(text)) info(id, 'Order and Interrupt are followed by an en dash, not a colon: **Order** –');
      if (card.type === 'dilemma' && /\bUnless you have\b/i.test(text) && !raw.includes('**')) {
        warn(id, 'Dilemma requirements print in bold: wrap the skills after “Unless you have” in **…**.');
      }
      // a keyword opening the text, not in bold
      const first = text.split(/[.\n]/)[0].trim();
      const kw = ctx.keywords.find((k) => first === k || first.startsWith(`${k}:`) || first.startsWith(`${k} `));
      if (kw && !raw.trimStart().startsWith('**')) info(id, `Keywords print in bold: **${kw}**`);
    }

    if (id === 'lore' && card.type === 'mission' && !/^\*[^*]+:\s*\*/.test(raw.trim())) {
      info(id, 'Mission lore usually opens with the place in italics: *Qo’noS:* “…”');
    }

    // skill names written in lowercase ("a security personnel")
    const lower: string[] = [];
    for (const s of ctx.skills) {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRe(s.toLowerCase())}(?![\\p{L}])`, 'u');
      if (re.test(text)) lower.push(s);
    }
    if (lower.length) info(id, `${label}: ${lower.map((s) => `“${s.toLowerCase()}”`).join(', ')} ${lower.length === 1 ? 'is a skill name' : 'are skill names'}; the cards capitalise skills (${lower.join(', ')}) and print them in bold when they are requirements.`);

    // capitalised words that are almost a skill ("Diplomcy") in requirements or bold spans
    const candidates: string[] = [];
    if (id === 'requirements') candidates.push(text);
    for (const r of parseMarkup(raw)) if (r.kind === 'text' && r.bold) candidates.push(r.text);
    const seen = new Set<string>();
    for (const chunk of candidates) {
      for (const m of chunk.matchAll(/\b([A-Z][a-z]{3,})\b/g)) {
        const word = m[1];
        if (seen.has(word) || ATTRIBUTES.includes(word) || ctx.keywords.includes(word)) continue;
        seen.add(word);
        const near = nearestSkill(word, ctx.skills);
        if (near) warn(id, `${label}: “${word}” is not a skill; did you mean ${near}?`);
      }
    }
  }

  const ci = (f.collectorInfo ?? '').trim();
  if (ci && !/^\d+\s+[A-Z]{1,2}\s+\d+$/.test(ci)) info('collectorInfo', 'Collector info prints as set, rarity and number: 25 V 1.');

  return out;
}
