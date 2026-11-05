/**
 * Typographic substitutions applied when text is drawn, so what people type with a plain keyboard
 * prints the way the real cards do. The stored text is left as typed.
 *
 *   "quote"   → “quote”          'quote' → ‘quote’       it's → it’s
 *   a - b     → a – b (en dash)  a--b    → a–b           a---b → a—b (em dash)
 *   cost -2   → cost –2 (minus)  5-3 and Non-Aligned keep their hyphen
 *   ...       → …
 */

/** Characters after which a quote opens rather than closes (markup markers count, so *"x"* works). */
const OPENERS = /[\s(\[{<*–—/]/;

export function typeset(src: string): string {
  if (!src) return src;
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const prev = i > 0 ? src[i - 1] : '';
    const next = src[i + 1] ?? '';
    const opens = i === 0 || OPENERS.test(prev);
    if (ch === '"') {
      out += opens ? '“' : '”';
      continue;
    }
    if (ch === "'") {
      // an opening single quote needs something quotable after it; everything else is an apostrophe
      out += opens && /[\p{L}\p{N}"“]/u.test(next) ? '‘' : '’';
      continue;
    }
    if (ch === '.' && src.startsWith('...', i)) {
      out += '…';
      i += 2;
      continue;
    }
    if (ch === '-') {
      if (src.startsWith('---', i)) {
        out += '—';
        i += 2;
        continue;
      }
      if (src.startsWith('--', i)) {
        out += '–';
        i += 1;
        continue;
      }
      const spaceBefore = prev !== '' && /\s/.test(prev);
      const spaceAfter = next === '' || /\s/.test(next);
      if (spaceBefore && spaceAfter) {
        out += '–';
        continue;
      }
      // a minus sign before a number, as in "cost -2": the cards print it as an en dash (ranges like 5-3 and words keep their hyphen)
      if (/\d/.test(next) && (prev === '' || /[\s(]/.test(prev))) {
        out += '–';
        continue;
      }
    }
    out += ch;
  }
  return out;
}
