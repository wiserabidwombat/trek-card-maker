import { describe, it, expect } from 'vitest';
import { expandCopies, planTtsSheets, TTS_MAX_TEXTURE, TTS_SHEET_MAX, ttsCellSize, ttsFileName } from './tts';

describe('planTtsSheets', () => {
  it('keeps 69 cards per sheet and shrinks the grid for small decks', () => {
    expect(planTtsSheets(0)).toEqual([]);
    expect(planTtsSheets(5)).toEqual([{ count: 5, cols: 5, rows: 1 }]);
    expect(planTtsSheets(23)).toEqual([{ count: 23, cols: 10, rows: 3 }]);
    expect(planTtsSheets(TTS_SHEET_MAX)).toEqual([{ count: 69, cols: 10, rows: 7 }]);
    expect(planTtsSheets(70)).toEqual([
      { count: 69, cols: 10, rows: 7 },
      { count: 1, cols: 1, rows: 1 },
    ]);
    expect(planTtsSheets(150).map((p) => p.count)).toEqual([69, 69, 12]);
  });
});

describe('ttsCellSize', () => {
  const card = { w: 1040, h: 1490 };

  it('fits a full sheet inside the texture limit in both directions', () => {
    const cell = ttsCellSize(card, { cols: 10, rows: 7 });
    expect(cell.w * 10).toBeLessThanOrEqual(TTS_MAX_TEXTURE);
    expect(cell.h * 7).toBeLessThanOrEqual(TTS_MAX_TEXTURE);
    expect(cell.h / cell.w).toBeCloseTo(card.h / card.w, 2);
  });

  it('never enlarges the card', () => {
    expect(ttsCellSize(card, { cols: 3, rows: 1 })).toEqual({ w: 1040, h: 1490 });
  });

  it('is limited by height when the grid is tall and narrow', () => {
    const cell = ttsCellSize(card, { cols: 1, rows: 7 });
    expect(cell.h * 7).toBeLessThanOrEqual(TTS_MAX_TEXTURE);
    expect(cell.w).toBeLessThan(card.w);
  });
});

describe('expandCopies', () => {
  it('repeats items by their copy count and drops zero or negative ones', () => {
    const items = [
      { id: 'a', copies: 2 },
      { id: 'b', copies: 0 },
      { id: 'c', copies: 1 },
      { id: 'd', copies: -3 },
    ];
    expect(expandCopies(items).map((i) => i.id)).toEqual(['a', 'a', 'c']);
  });
});

describe('ttsFileName', () => {
  it('names single sheets, numbered sheets and the back', () => {
    expect(ttsFileName('klingon', 1, 1, 'jpg')).toBe('trek-deck-klingon-tts.jpg');
    expect(ttsFileName('klingon', 2, 3, 'jpg')).toBe('trek-deck-klingon-tts-2of3.jpg');
    expect(ttsFileName('', 'back', 1, 'png')).toBe('trek-deck-deck-tts-back.png');
  });
});
