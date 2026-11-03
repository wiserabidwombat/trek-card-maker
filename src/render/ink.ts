/** Default text colour: pure black so printers use the black cartridge alone. */
export const INK_BLACK = '#000000';

/**
 * The colour to paint text in. The originals use a rich black (#231f20 or #030404) for dark text
 * and white on dark discs and blue boxes; dark source colours become pure black, anything else
 * is kept as is.
 */
export function inkColour(source?: string | null): string {
  if (!source) return INK_BLACK;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(source.trim());
  if (!m) return INK_BLACK;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.3 ? INK_BLACK : `#${m[1]}${m[2]}${m[3]}`.toLowerCase();
}
