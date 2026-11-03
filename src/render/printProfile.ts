/**
 * Output adjustments per printer type. Inkjets spread ink on the paper, which blurs light
 * strokes and small text; the inkjet profile pre-compensates with heavier weights, slightly larger
 * small text, sharpened icons and lossless embedding of the card raster.
 */
export type PrintProfile = 'laser' | 'inkjet';

export interface RenderProfile {
  /** Light -> Regular, Regular -> Medium for body text. */
  heavierText: boolean;
  /** Multiply the size of text smaller than `smallTextPt` points. */
  smallTextScale: number;
  smallTextPt: number;
  /** Apply an unsharp mask to icons before drawing. */
  sharpenIcons: boolean;
  /** Embed the card raster as PNG instead of JPEG. */
  lossless: boolean;
}

export const PROFILES: Record<PrintProfile, RenderProfile> = {
  laser: { heavierText: false, smallTextScale: 1, smallTextPt: 0, sharpenIcons: false, lossless: false },
  inkjet: { heavierText: true, smallTextScale: 1.05, smallTextPt: 7.5, sharpenIcons: true, lossless: true },
};

export const SCREEN_PROFILE: RenderProfile = PROFILES.laser;

/** Point size after the profile's small-text bump. */
export function profiledPt(sizePt: number, p: RenderProfile): number {
  return sizePt < p.smallTextPt ? sizePt * p.smallTextScale : sizePt;
}

/** CSS font weight for a body style under the profile. */
export function bodyWeight(style: { bold?: boolean; light?: boolean }, heavier: boolean): number {
  if (style.bold) return 700;
  if (style.light) return heavier ? 400 : 300;
  return heavier ? 500 : 400;
}

/**
 * 3x3 unsharp mask on RGBA pixels (alpha untouched), amount 0.6. Pure so it can be tested; the
 * renderer wraps it around canvas ImageData.
 */
export function sharpenPixels(data: Uint8ClampedArray, w: number, h: number, amount = 0.6): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  const k = amount;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const centre = data[i + c];
        const blur =
          (data[i - 4 + c] + data[i + 4 + c] + data[i - w * 4 + c] + data[i + w * 4 + c] + centre * 4) / 8;
        out[i + c] = Math.max(0, Math.min(255, centre + (centre - blur) * k * 4));
      }
    }
  }
  return out;
}

const PROFILE_KEY = 'trek-card-maker:printProfile';

export function loadPrintProfile(): PrintProfile {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_KEY) : null;
    return v === 'inkjet' ? 'inkjet' : 'laser';
  } catch {
    return 'laser';
  }
}

export function savePrintProfile(p: PrintProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, p);
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}
