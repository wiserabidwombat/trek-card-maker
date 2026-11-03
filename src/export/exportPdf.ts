import { PDFDocument, rgb } from 'pdf-lib';
import { hexToRgb01, mapTextOp, type TextOp } from '../render/textOps';
import { PdfFontRegistry, type UserFontBytes } from './pdfFonts';
import { cutMarks, layoutSheet, LETTER } from './sheetLayout';

export interface SheetItem {
  canvas: HTMLCanvasElement;
  copies: number;
  /** Text recorded by the renderer, drawn as real PDF text over the raster. */
  textOps?: TextOp[];
}

function canvasToBytes(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality = 0.95): Promise<Uint8Array> {
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

export interface JpegItem {
  jpeg: Uint8Array;
  copies: number;
  /** When true `jpeg` holds PNG bytes (lossless, for inkjet output). */
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
}

/** Build a US Letter print sheet from pre-encoded JPEGs: 3x3 cards per page with cut marks. */
export async function buildSheetPdfFromJpegs(items: JpegItem[], options: SheetOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Trek Card Maker print sheet');
  const fonts = new PdfFontRegistry(doc, options.userFonts ?? {}, options.loadFont);
  const placements: { img: Awaited<ReturnType<PDFDocument['embedJpg']>>; item: JpegItem }[] = [];
  for (const item of items) {
    if (item.copies <= 0) continue;
    const img = item.png ? await doc.embedPng(item.jpeg) : await doc.embedJpg(item.jpeg);
    for (let i = 0; i < item.copies; i++) placements.push({ img, item });
  }
  const slots = layoutSheet(placements.length);
  const pages: ReturnType<PDFDocument['addPage']>[] = [];
  const marks = cutMarks();
  for (const [i, slot] of slots.entries()) {
    while (pages.length <= slot.page) {
      const page = doc.addPage([LETTER.w, LETTER.h]);
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
  if (!pages.length) doc.addPage([LETTER.w, LETTER.h]);
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
