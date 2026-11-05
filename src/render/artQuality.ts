import type { CropRect } from '../model/card';

/** Printed card width; the art box is a fraction of it. */
export const CARD_WIDTH_MM = 63;
/** Resolution at which artwork prints without visible softening. */
export const GOOD_DPI = 300;
/** Below this the picture is noticeably blurry on paper. */
export const LOW_DPI = 200;

export type ArtQuality = 'good' | 'soft' | 'low';

/**
 * Effective print resolution of a crop: the source pixels spanning the art box divided by the art
 * box's printed width. A crop wider than the picture (zoomed out) still maps pixels to paper at the
 * same rate, so the formula holds.
 */
export function artPrintDpi(crop: Pick<CropRect, 'w'>, artWidthFraction: number, cardWidthMm = CARD_WIDTH_MM): number {
  if (crop.w <= 0 || artWidthFraction <= 0) return 0;
  const inches = (artWidthFraction * cardWidthMm) / 25.4;
  return crop.w / inches;
}

export function artQuality(dpi: number): ArtQuality {
  if (dpi >= GOOD_DPI) return 'good';
  if (dpi >= LOW_DPI) return 'soft';
  return 'low';
}

/** Source pixels the current crop would need across for 300 dpi. */
export function pixelsForGood(artWidthFraction: number, cardWidthMm = CARD_WIDTH_MM): number {
  return Math.ceil(((artWidthFraction * cardWidthMm) / 25.4) * GOOD_DPI);
}

/** One sentence for the artwork panel; null when the picture is fine. */
export function describeArtQuality(dpi: number, artWidthFraction: number): string | null {
  const q = artQuality(dpi);
  if (q === 'good') return null;
  const need = pixelsForGood(artWidthFraction);
  const rounded = Math.round(dpi / 10) * 10;
  return q === 'soft'
    ? `Prints at about ${rounded} dpi: slightly soft. ${need} px across the cropped area gives 300 dpi.`
    : `Prints at about ${rounded} dpi: it will look blurry. ${need} px across the cropped area gives 300 dpi.`;
}
