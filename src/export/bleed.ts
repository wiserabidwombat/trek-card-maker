import { MM } from './paper';

/**
 * Bleed: the black card border is extended past the cut lines, so a cut that drifts a little
 * leaves a black sliver instead of a white one. Cards printed with bleed get square corners
 * (round them with a corner punch); the cut marks stay exactly where they were.
 */
export const BLEED_MM = 2;
export const BLEED_PT = BLEED_MM * MM;

const BLEED_KEY = 'trek-card-maker.bleed';

export function loadBleed(): boolean {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(BLEED_KEY) : null;
    return v !== 'off';
  } catch {
    return true;
  }
}

export function saveBleed(on: boolean): void {
  try {
    localStorage.setItem(BLEED_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}
