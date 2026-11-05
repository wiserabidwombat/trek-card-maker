/**
 * Collector info as the cards print it in the bottom bar: set number, rarity code, card number,
 * "25 V 1". The card stores the printed string; these helpers take it apart for the three-box
 * editor and the spreadsheet import, and put it back together.
 */
export interface CollectorInfo {
  set: string;
  rarity: string;
  number: string;
}

export const RARITIES: { code: string; label: string }[] = [
  { code: 'C', label: 'Common' },
  { code: 'U', label: 'Uncommon' },
  { code: 'R', label: 'Rare' },
  { code: 'P', label: 'Promo' },
  { code: 'V', label: 'Virtual' },
  { code: 'VP', label: 'Virtual promo' },
];

/** "25 V 1" → parts; anything else (including partial strings) → null. */
export function parseCollector(text: string): CollectorInfo | null {
  const m = /^\s*(\d+)\s+([A-Za-z]{1,2})\s+(\d+)\s*$/.exec(text ?? '');
  return m ? { set: m[1], rarity: m[2].toUpperCase(), number: m[3] } : null;
}

/**
 * Best-effort split of a partial or odd string for the editor boxes: a letters token is the rarity,
 * the first digits token the set, the next the number. "25 V" → set 25, rarity V; "V 3" → rarity V,
 * number 3 is ambiguous, so the digits land in the set box.
 */
export function looseCollector(text: string): CollectorInfo {
  const exact = parseCollector(text);
  if (exact) return exact;
  const out: CollectorInfo = { set: '', rarity: '', number: '' };
  for (const tok of (text ?? '').trim().split(/\s+/).filter(Boolean)) {
    if (/^[A-Za-z]{1,2}$/.test(tok) && !out.rarity) out.rarity = tok.toUpperCase();
    else if (/^\d+$/.test(tok) && !out.set) out.set = tok;
    else if (/^\d+$/.test(tok) && !out.number) out.number = tok;
  }
  return out;
}

/** Parts → the printed string; missing parts are left out so partial entries still print something. */
export function formatCollector(info: Partial<CollectorInfo>): string {
  return [info.set, info.rarity?.toUpperCase(), info.number]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** The collector info a new card gets after `prev`: same set and rarity, next number; empty when prev has no number. */
export function nextCollector(prev: string): string {
  const p = parseCollector(prev);
  if (!p) return '';
  const width = p.number.length;
  const n = String(Number.parseInt(p.number, 10) + 1).padStart(p.number.startsWith('0') ? width : 0, '0');
  return formatCollector({ ...p, number: n });
}
