import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { buildSheetPdfFromJpegs } from './exportPdf';

// Uses real extracted frames when present; otherwise a tiny generated JPEG is not available in jsdom, so skip.
const frames = ['public/frames/SacrificeofAngels/001.jpg', 'public/frames/Caretaker/001.jpg'];
const available = frames.every((f) => existsSync(f));

describe.skipIf(!available)('print sheet PDF (smoke)', () => {
  it('lays out copies across pages and embeds images at native size', async () => {
    const items = frames.map((f, i) => ({ jpeg: new Uint8Array(readFileSync(f)), copies: i === 0 ? 7 : 4 }));
    const bytes = await buildSheetPdfFromJpegs(items);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2); // 11 cards -> 9 + 2
    expect(doc.getPage(0).getWidth()).toBe(612);
    expect(doc.getPage(1).getHeight()).toBe(792);
    const out = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SHEET_SMOKE_OUT;
    if (out) writeFileSync(out, bytes);
  });
});
