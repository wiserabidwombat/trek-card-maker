import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import { buildSheetPdfFromJpegs, isPng } from './exportPdf';
import type { TextOp } from '../render/textOps';
import { MM } from './sheetLayout';

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

/** Each page's content stream as operator text (pdf-lib deflates them on save). */
async function pageOps(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const c = page.node.Contents();
    const streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
    return streams.map((s) => (s instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(s).decode()).toString('latin1') : '')).join('\n');
  });
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

  it('follows every sheet with a mirrored back page when a back is given', async () => {
    const items = [{ jpeg: new Uint8Array(readFileSync(frames[0])), copies: 11, cardW: 1022, cardH: 1464 }];
    const back = new Uint8Array(readFileSync(frames[1]));
    const doc = await PDFDocument.load(await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, back }));
    expect(doc.getPageCount()).toBe(4); // front, back, front, back
    expect(doc.getPage(1).getWidth()).toBe(612);
  });

  it('lays black bleed under every slot, fronts and backs, before the images', async () => {
    const items = [{ jpeg: new Uint8Array(readFileSync(frames[0])), copies: 3, cardW: 1022, cardH: 1464 }];
    const back = new Uint8Array(readFileSync(frames[1]));
    const plain = await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, back });
    const bled = await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, back, bleed: 2 * MM });
    // pdf-lib draws a filled rectangle as a translated closed path ending in "h f"; nothing else on the sheet is filled
    const fills = async (bytes: Uint8Array) => (await pageOps(bytes)).map((ops) => (ops.match(/\nh\nf\n/g) ?? []).length);
    expect(await fills(plain)).toEqual([0, 0]);
    expect(await fills(bled)).toEqual([3, 3]); // three slots on the front page, three on the back page
    // the first slot's bleed starts 2 mm outside its corner at 38.13 x (792 - 21.83 - 249.45) and spans 63+4 x 88+4 mm
    expect((await pageOps(bled))[0]).toMatch(
      /1 0 0 1 32\.4\d* 515\.0\d* cm\n(?:1 0 0 1 0 0 cm\n)*0 0 m\n0 260\.7\d* l\n189\.9\d* 260\.7\d* l\n189\.9\d* 0 l\nh\nf\n/,
    );
  });

  it('moves the back pages by the duplex offset and leaves the fronts alone', async () => {
    const items = [{ jpeg: new Uint8Array(readFileSync(frames[0])), copies: 1, cardW: 1022, cardH: 1464 }];
    const back = new Uint8Array(readFileSync(frames[1]));
    const ops = await pageOps(await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, back, backOffset: { x: 0.5 * MM, y: -0.3 * MM } }));
    // front image at the first slot (38.13, 520.72); the mirrored back at 612 - 38.13 - 178.58 = 395.29, moved 0.5 mm right and 0.3 mm down
    expect(ops[0]).toMatch(/1 0 0 1 38\.1\d* 520\.7\d* cm/);
    expect(ops[1]).toMatch(/1 0 0 1 396\.7\d* 519\.8\d* cm/);
    expect(ops[1]).not.toMatch(/1 0 0 1 395\.2\d* 520\.7\d* cm/);
  });

  it('makes A4 pages with the grid centred when asked', async () => {
    const items = [{ jpeg: new Uint8Array(readFileSync(frames[0])), copies: 9, cardW: 1022, cardH: 1464 }];
    const doc = await PDFDocument.load(await buildSheetPdfFromJpegs(items, { loadFont: loadFontFromDisk, paper: 'a4' }));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 2);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 2);
  });
});

describe('isPng', () => {
  it('recognises the PNG signature and nothing else', () => {
    expect(isPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe(true);
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(false);
    expect(isPng(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});
