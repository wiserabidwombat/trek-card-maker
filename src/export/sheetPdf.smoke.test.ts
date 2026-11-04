import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildSheetPdfFromJpegs } from './exportPdf';
import type { TextOp } from '../render/textOps';

// Uses real extracted frames when present; otherwise a tiny generated JPEG is not available in jsdom, so skip.
const frames = ['public/frames/SacrificeofAngels/001.jpg', 'public/frames/Caretaker/001.jpg'];
const available = frames.every((f) => existsSync(f));

/** Vite serves bundled fonts by URL; under vitest the URL is a path we can read from node_modules. */
async function loadFontFromDisk(url: string): Promise<Uint8Array> {
  const file = url.split('?')[0].replace(/^\/@fs\//, '').replace(/^\//, '');
  const candidates = [file, `node_modules/${file.replace(/^.*node_modules\//, '')}`];
  for (const c of candidates) if (existsSync(c)) return new Uint8Array(readFileSync(c));
  throw new Error(`font not found for ${url}`);
}

describe.skipIf(!available)('print sheet PDF (smoke)', () => {
  it('lays out copies across pages, embeds images at native size and draws vector text', async () => {
    const title: TextOp = { text: 'Worf', spec: { family: 'title', weight: 700, italic: true }, sizePx: 54, x: 260, y: 60, colour: '#000000' };
    const body: TextOp = { text: '2 Leadership', spec: { family: 'body', weight: 700, italic: false }, sizePx: 44, x: 160, y: 960, colour: '#000000' };
    const items = frames.map((f, i) => ({
      jpeg: new Uint8Array(readFileSync(f)),
      copies: i === 0 ? 7 : 4,
      textOps: i === 0 ? [title, body] : [],
      cardW: 1022,
      cardH: 1464,
    }));
    const bytes = await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2); // 11 cards -> 9 + 2
    expect(doc.getPage(0).getWidth()).toBe(612);
    expect(doc.getPage(1).getHeight()).toBe(792);
    const out = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SHEET_SMOKE_OUT;
    if (out) writeFileSync(out, bytes);
  });

  it('makes A4 pages with the grid centred when asked', async () => {
    const items = [{ jpeg: new Uint8Array(readFileSync(frames[0])), copies: 9, cardW: 1022, cardH: 1464 }];
    const doc = await PDFDocument.load(await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, paper: 'a4' }));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
  });
});
