/**
 * Duplex offset: most printers put the second side a fraction of a millimetre off the first.
 * The back pages can be shifted to compensate, measured once per printer: print one duplex sheet,
 * hold it to the light, and enter the opposite of how far the backs sit from the fronts.
 */
export interface BackOffset {
  /** Millimetres the backs move to the right, as seen looking at the back of the sheet. */
  x: number;
  /** Millimetres the backs move up. */
  y: number;
}

export const OFFSET_LIMIT_MM = 5;
const OFFSET_KEY = 'trek-card-maker.back-offset';

/** Clamp to ±OFFSET_LIMIT_MM and a tenth of a millimetre; anything unreadable is 0. */
export function clampOffset(v: unknown): number {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(-OFFSET_LIMIT_MM, Math.min(OFFSET_LIMIT_MM, n)) * 10) / 10;
}

export function loadBackOffset(): BackOffset {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(OFFSET_KEY) : null;
    const v = raw ? (JSON.parse(raw) as Partial<BackOffset>) : {};
    return { x: clampOffset(v.x), y: clampOffset(v.y) };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function saveBackOffset(o: BackOffset): void {
  try {
    localStorage.setItem(OFFSET_KEY, JSON.stringify({ x: clampOffset(o.x), y: clampOffset(o.y) }));
  } catch {
    /* storage unavailable: the offset just is not remembered */
  }
}
