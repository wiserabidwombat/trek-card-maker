/**
 * Where a custom corner emblem goes inside the frame's affiliation disc: a square that fits the
 * picture ("contain") within the disc, leaving a margin so the corners of a square picture stay
 * inside the circle.
 */
export const EMBLEM_INSET = 0.72; // the picture's longer side as a fraction of the disc diameter

export interface EmblemRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function emblemFit(cx: number, cy: number, r: number, natW: number, natH: number, inset = EMBLEM_INSET): EmblemRect {
  const side = 2 * r * inset;
  const scale = side / Math.max(natW, natH, 1);
  const w = natW * scale;
  const h = natH * scale;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
