export type Run =
  | { kind: 'text'; text: string; bold: boolean; italic: boolean }
  | { kind: 'icon'; id: string }
  | { kind: 'break' };

/**
 * Parse the tiny inline markup used in game text:
 *   **bold**, *italic*, {icon:id}, and newlines as line breaks.
 * Unmatched markers are kept literally.
 */
export function parseMarkup(src: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  let italic = false;
  let buf = '';

  const flush = () => {
    if (buf) {
      runs.push({ kind: 'text', text: buf, bold, italic });
      buf = '';
    }
  };

  // Which markers can be closed later, so an opening marker is only honoured when a match exists.
  const hasClosing = (marker: string, from: number): boolean => {
    let i = from;
    while (i < src.length) {
      const j = src.indexOf(marker, i);
      if (j < 0) return false;
      if (marker === '*' && src[j + 1] === '*') {
        i = j + 2;
        continue;
      }
      return true;
    }
    return false;
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      flush();
      runs.push({ kind: 'break' });
      i += 1;
      continue;
    }
    if (src.startsWith('**', i)) {
      if (bold || hasClosing('**', i + 2)) {
        flush();
        bold = !bold;
        i += 2;
        continue;
      }
      buf += '**';
      i += 2;
      continue;
    }
    if (ch === '*') {
      if (italic || hasClosing('*', i + 1)) {
        flush();
        italic = !italic;
        i += 1;
        continue;
      }
      buf += '*';
      i += 1;
      continue;
    }
    if (src.startsWith('{icon:', i)) {
      const end = src.indexOf('}', i);
      const id = end > 0 ? src.slice(i + 6, end).trim() : '';
      if (end > 0 && id) {
        flush();
        runs.push({ kind: 'icon', id });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return runs;
}
