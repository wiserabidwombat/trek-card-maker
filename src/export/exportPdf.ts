import { PDFDocument, rgb } from 'pdf-lib';
import { cutMarks, layoutSheet, LETTER } from './sheetLayout';

export interface SheetItem {
  canvas: HTMLCanvasElement;
  copies: number;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.95): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not encode card image'));
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

export interface JpegItem {
  jpeg: Uint8Array;
  copies: number;
}

/** Build a US Letter print sheet from pre-encoded JPEGs: 3x3 cards per page with cut marks. */
export async function buildSheetPdfFromJpegs(items: JpegItem[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Trek Card Maker print sheet');
  const placements: { img: Awaited<ReturnType<PDFDocument['embedJpg']>> }[] = [];
  for (const item of items) {
    if (item.copies <= 0) continue;
    const img = await doc.embedJpg(item.jpeg);
    for (let i = 0; i < item.copies; i++) placements.push({ img });
  }
  const slots = layoutSheet(placements.length);
  const pages: ReturnType<PDFDocument['addPage']>[] = [];
  const marks = cutMarks();
  slots.forEach((slot, i) => {
    while (pages.length <= slot.page) {
      const page = doc.addPage([LETTER.w, LETTER.h]);
      for (const m of marks) {
        page.drawLine({ start: { x: m.x1, y: m.y1 }, end: { x: m.x2, y: m.y2 }, thickness: 0.25, color: rgb(0, 0, 0) });
      }
      pages.push(page);
    }
    pages[slot.page].drawImage(placements[i].img, { x: slot.x, y: slot.y, width: slot.w, height: slot.h });
  });
  if (!pages.length) doc.addPage([LETTER.w, LETTER.h]);
  return doc.save();
}

/** Build a US Letter print sheet from rendered card canvases. */
export async function buildSheetPdf(items: SheetItem[]): Promise<Uint8Array> {
  const encoded: JpegItem[] = [];
  for (const item of items) {
    if (item.copies <= 0) continue;
    encoded.push({ jpeg: await canvasToJpeg(item.canvas), copies: item.copies });
  }
  return buildSheetPdfFromJpegs(encoded);
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
