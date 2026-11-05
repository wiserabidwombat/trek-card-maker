import { PDFDocument, rgb } from 'pdf-lib';
import { hexToRgb01, mapTextOp, type TextOp } from '../render/textOps';
import { PdfFontRegistry, type UserFontBytes } from './pdfFonts';
import { cutMarks, layoutSheet, mirrorSlots } from './sheetLayout';
import { PAPERS, type Paper } from './paper';

export interface SheetItem {
  canvas: HTMLCanvasElement;
  copies: number;
  /** Text recorded by the renderer, drawn as real PDF text over the raster. */
  textOps?: TextOp[];
}

/** Encode a canvas as JPEG or PNG bytes. */
export function canvasToBytes(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality = 0.95): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not encode card image'));
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      type,
      quality,
    );
  });
}

/** PNG files start with these eight bytes; anything else handed to us is treated as JPEG. */
export function isPng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= 8 && sig.every((b, i) => bytes[i] === b);
}

export interface JpegItem {
  jpeg: Uint8Array;
  copies: number;
  /** When true `jpeg` holds PNG bytes (lossless, for inkjet output). The bytes are sniffed anyway: some browsers return PNG when asked for JPEG. */
  png?: boolean;
  textOps?: TextOp[];
  /** Pixel size of the raster, needed to place text ops; defaults to the image's own size. */
  cardW?: number;
  cardH?: number;
}

export interface SheetOptions {
  userFonts?: UserFontBytes;
  /** Font file loader; tests pass one that reads from disk. */
  loadFont?: (url: string) => Promise<Uint8Array>;
  /** Sheet size; US Letter unless given. */
  paper?: Paper;
  /** Card back (PNG or JPEG bytes). When given, a mirrored back page follows every sheet for duplex printing. */
  back?: Uint8Array;
}

/** Build a print sheet (US Letter or A4) from pre-encoded JPEGs: 3x3 cards per page with cut marks. */
export async function buildSheetPdfFromJpegs(items: JpegItem[], options: SheetOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Trek Card Maker print sheet');
  const fonts = new PdfFontRegistry(doc, options.userFonts ?? {}, options.loadFont);
  const placements: { img: Awaited<ReturnType<PDFDocument['embedJpg']>>; item: JpegItem }[] = [];
  for (const item of items) {
    if (item.copies <= 0) continue;
    const img = item.png || isPng(item.jpeg) ? await doc.embedPng(item.jpeg) : await doc.embedJpg(item.jpeg);
    for (let i = 0; i < item.copies; i++) placements.push({ img, item });
  }
  const paper = options.paper ?? 'letter';
  const size = PAPERS[paper];
  const slots = layoutSheet(placements.length, paper);
  const pages: ReturnType<PDFDocument['addPage']>[] = [];
  const marks = cutMarks(paper);
  for (const [i, slot] of slots.entries()) {
    while (pages.length <= slot.page) {
      const page = doc.addPage([size.w, size.h]);
      for (const m of marks) {
        page.drawLine({ start: { x: m.x1, y: m.y1 }, end: { x: m.x2, y: m.y2 }, thickness: 0.25, color: rgb(0, 0, 0) });
      }
      pages.push(page);
    }
    const page = pages[slot.page];
    const { img, item } = placements[i];
    page.drawImage(img, { x: slot.x, y: slot.y, width: slot.w, height: slot.h });
    const cardW = item.cardW ?? img.width;
    const cardH = item.cardH ?? img.height;
    for (const op of item.textOps ?? []) {
      if (!op.text) continue;
      const p = mapTextOp(op, slot, cardW, cardH);
      const [r, g, b] = hexToRgb01(op.colour);
      page.drawText(op.text, { x: p.x, y: p.y, size: p.size, font: await fonts.font(op.spec), color: rgb(r, g, b) });
    }
  }
  if (!pages.length) doc.addPage([size.w, size.h]);
  if (options.back && pages.length) {
    const backImg = isPng(options.back) ? await doc.embedPng(options.back) : await doc.embedJpg(options.back);
    const mirrored = mirrorSlots(slots, paper);
    // insert after each front page, working backwards so earlier indices stay valid
    for (let p = pages.length - 1; p >= 0; p--) {
      const page = doc.insertPage(p + 1, [size.w, size.h]);
      for (const m of marks) {
        page.drawLine({ start: { x: m.x1, y: m.y1 }, end: { x: m.x2, y: m.y2 }, thickness: 0.25, color: rgb(0, 0, 0) });
      }
      for (const slot of mirrored) {
        if (slot.page !== p) continue;
        page.drawImage(backImg, { x: slot.x, y: slot.y, width: slot.w, height: slot.h });
      }
    }
  }
  return doc.save();
}

/** Build a US Letter print sheet from rendered card canvases (JPEG q0.95, or PNG when lossless). */
export async function buildSheetPdf(items: SheetItem[], lossless = false, options: SheetOptions = {}): Promise<Uint8Array> {
  const encoded: JpegItem[] = [];
  for (const item of items) {
    if (item.copies <= 0) continue;
    const bytes = await canvasToBytes(item.canvas, lossless ? 'image/png' : 'image/jpeg');
    encoded.push({ jpeg: bytes, copies: item.copies, png: lossless, textOps: item.textOps, cardW: item.canvas.width, cardH: item.canvas.height });
  }
  return buildSheetPdfFromJpegs(encoded, options);
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/pdf'): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
