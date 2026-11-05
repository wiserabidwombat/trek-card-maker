/** Pure helpers behind the text-field toolbar: they return the new value and where the selection goes. */
export interface Edit {
  value: string;
  start: number;
  end: number;
}

function ordered(start: number, end: number): [number, number] {
  return start <= end ? [start, end] : [end, start];
}

/**
 * Wrap the selection in `marker` (`**` or `*`), or remove the markers when the selection already
 * carries them, inside or just outside. An empty selection gets an empty pair with the caret between.
 */
export function toggleWrap(value: string, start: number, end: number, marker: string): Edit {
  let [s, e] = ordered(start, end);
  // spaces at the edges of the selection stay outside the markers (a double-click selects the trailing space on Windows)
  while (s < e && /\s/.test(value[s])) s++;
  while (e > s && /\s/.test(value[e - 1])) e--;
  const m = marker.length;
  const inner = value.slice(s, e);
  if (inner.length >= 2 * m && inner.startsWith(marker) && inner.endsWith(marker)) {
    const stripped = inner.slice(m, inner.length - m);
    return { value: value.slice(0, s) + stripped + value.slice(e), start: s, end: s + stripped.length };
  }
  const before = value.slice(Math.max(0, s - m), s);
  const after = value.slice(e, e + m);
  // the character beyond must not be another marker character, or toggling * inside ** would eat the bold
  const outerBefore = value[s - m - 1];
  const outerAfter = value[e + m];
  if (s - m >= 0 && before === marker && after === marker && outerBefore !== marker[0] && outerAfter !== marker[0]) {
    return { value: value.slice(0, s - m) + inner + value.slice(e + m), start: s - m, end: s - m + inner.length };
  }
  return { value: value.slice(0, s) + marker + inner + marker + value.slice(e), start: s + m, end: s + m + inner.length };
}

/**
 * Replace the selection with `text` and put the caret after it. With `spaced`, a space is added on
 * either side where the insertion would otherwise touch a word.
 */
export function insertText(value: string, start: number, end: number, text: string, opts: { spaced?: boolean } = {}): Edit {
  const [s, e] = ordered(start, end);
  let ins = text;
  if (opts.spaced) {
    if (s > 0 && !/\s/.test(value[s - 1]) && !/^\s/.test(ins)) ins = ' ' + ins;
    if (e < value.length && !/\s/.test(value[e]) && !/\s$/.test(ins)) ins = ins + ' ';
  }
  const caret = s + ins.length;
  return { value: value.slice(0, s) + ins + value.slice(e), start: caret, end: caret };
}
