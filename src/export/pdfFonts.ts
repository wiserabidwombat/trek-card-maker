import type { PDFDocument, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { specKey, type TextSpec } from '../render/textOps';
import exo700i from '@fontsource/exo-2/files/exo-2-latin-700-italic.woff?url';
import fira300 from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-300-normal.woff?url';
import fira300i from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-300-italic.woff?url';
import fira400 from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-400-normal.woff?url';
import fira400i from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-400-italic.woff?url';
import fira500 from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-500-normal.woff?url';
import fira500i from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-500-italic.woff?url';
import fira700 from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-700-normal.woff?url';
import fira700i from '@fontsource/fira-sans-condensed/files/fira-sans-condensed-latin-700-italic.woff?url';

/** Bundled WOFF files (the WOFF2 variants do not survive fontkit's subsetter). */
export const BUNDLED_FONTS: Record<string, string> = {
  'title:700:i': exo700i,
  'body:300:n': fira300,
  'body:300:i': fira300i,
  'body:400:n': fira400,
  'body:400:i': fira400i,
  'body:500:n': fira500,
  'body:500:i': fira500i,
  'body:700:n': fira700,
  'body:700:i': fira700i,
};

/** The bundled variant to use for a spec: exact match, else the nearest weight with the same slant. */
export function nearestBundled(spec: TextSpec): string {
  const exact = specKey(spec);
  if (exact in BUNDLED_FONTS) return exact;
  const candidates = Object.keys(BUNDLED_FONTS).filter((k) => k.startsWith(spec.family + ':'));
  const slant = spec.italic ? 'i' : 'n';
  const sameSlant = candidates.filter((k) => k.endsWith(':' + slant));
  const pool = sameSlant.length ? sameSlant : candidates;
  return pool.sort((a, b) => Math.abs(Number(a.split(':')[1]) - spec.weight) - Math.abs(Number(b.split(':')[1]) - spec.weight))[0];
}

export interface UserFontBytes {
  title?: ArrayBuffer;
  body?: ArrayBuffer;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load font ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Embeds fonts into one PDF document on demand and caches them by variant. */
export class PdfFontRegistry {
  private cache = new Map<string, Promise<PDFFont>>();

  constructor(
    private doc: PDFDocument,
    private user: UserFontBytes = {},
    private load: (url: string) => Promise<Uint8Array> = fetchBytes,
  ) {
    doc.registerFontkit(fontkit);
  }

  font(spec: TextSpec): Promise<PDFFont> {
    // a user font replaces every weight of its slot: one file cannot be synthesised into bold or italic
    const userBytes = this.user[spec.family];
    const key = userBytes ? `user:${spec.family}` : nearestBundled(spec);
    let p = this.cache.get(key);
    if (!p) {
      p = (async () => {
        const bytes = userBytes ? new Uint8Array(userBytes) : await this.load(BUNDLED_FONTS[key]);
        return this.doc.embedFont(bytes, { subset: true });
      })();
      this.cache.set(key, p);
    }
    return p;
  }
}
