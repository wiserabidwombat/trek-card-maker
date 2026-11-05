/** What goes on the reverse of each printed card. */
export type BackChoice = 'none' | 'plain' | 'custom';

export const BACK_CHOICES: BackChoice[] = ['none', 'plain', 'custom'];

/** Pixel size of a generated back: 300 dpi at 63 × 88 mm. */
export const BACK_PX = { w: 744, h: 1039 };

const BACK_KEY = 'trek-card-maker.back';

export function loadBackChoice(): BackChoice {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(BACK_KEY) : null;
    return v === 'plain' || v === 'custom' ? v : 'none';
  } catch {
    return 'none';
  }
}

export function saveBackChoice(b: BackChoice): void {
  try {
    localStorage.setItem(BACK_KEY, b);
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}
