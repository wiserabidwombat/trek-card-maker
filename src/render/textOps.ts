/**
 * Text recorded by the renderer instead of painted, so the PDF export can draw it as real text.
 * Positions are canvas pixels of the finished card (border included); `y` is the baseline.
 */
export interface TextSpec {
  family: 'title' | 'body';
  weight: number;
  italic: boolean;
}

export interface TextOp {
  text: string;
  spec: TextSpec;
  sizePx: number;
  /** Left edge of the text run. */
  x: number;
  /** Alphabetic baseline. */
  y: number;
  /** CSS hex colour, #rrggbb. */
  colour: string;
  /** Anticlockwise rotation in degrees about (x, y); 90 runs the text up the card. Absent means upright. */
  rotate?: number;
}

export interface PdfTextPlacement {
  x: number;
  y: number;
  size: number;
}

/** Map a card-pixel text operation into PDF points inside a slot (PDF origin bottom-left). */
export function mapTextOp(
  op: Pick<TextOp, 'x' | 'y' | 'sizePx'>,
  slot: { x: number; y: number; w: number; h: number },
  cardW: number,
  cardH: number,
): PdfTextPlacement {
  const sx = slot.w / cardW;
  const sy = slot.h / cardH;
  return { x: slot.x + op.x * sx, y: slot.y + slot.h - op.y * sy, size: op.sizePx * sx };
}

/** '#rrggbb' → components in 0..1 (pdf-lib's rgb()). */
export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

/** Stable key for a font variant. */
export function specKey(spec: TextSpec): string {
  return `${spec.family}:${spec.weight}:${spec.italic ? 'i' : 'n'}`;
}
