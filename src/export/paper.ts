/** Sheet paper sizes. The card grid is the same on both; only the margins around it change. */
export type Paper = 'letter' | 'a4';

export const MM = 72 / 25.4;

export const PAPERS: Record<Paper, { w: number; h: number; label: string }> = {
  letter: { w: 612, h: 792, label: 'US Letter' },
  a4: { w: 210 * MM, h: 297 * MM, label: 'A4' }, // 595.28 x 841.89 pt
};

export const PAPER_LIST: Paper[] = ['letter', 'a4'];

const PAPER_KEY = 'trek-card-maker.paper';

export function loadPaper(): Paper {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PAPER_KEY) : null;
    return v === 'a4' ? 'a4' : 'letter';
  } catch {
    return 'letter';
  }
}

export function savePaper(p: Paper): void {
  try {
    localStorage.setItem(PAPER_KEY, p);
  } catch {
    /* storage unavailable: the choice just is not remembered */
  }
}
