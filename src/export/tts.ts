/**
 * Layout for Tabletop Simulator custom decks: one image holds a grid of card faces, at most 10
 * across and 7 down. TTS keeps the last of those 70 slots for the hidden face of a card in a
 * player's hand, so a sheet carries 69 cards; longer decks get several sheets. Unity textures are
 * capped at 4096 px, so cells shrink to keep a full sheet inside that.
 */
export const TTS_COLS = 10;
export const TTS_ROWS = 7;
export const TTS_SHEET_MAX = TTS_COLS * TTS_ROWS - 1;
export const TTS_MAX_TEXTURE = 4096;

export interface TtsSheetPlan {
  /** Cards on this sheet. */
  count: number;
  /** Grid width, the "Width" TTS asks for. */
  cols: number;
  /** Grid height, the "Height" TTS asks for. */
  rows: number;
}

/** Split a deck into sheets of at most 69 cards; a sheet with fewer than ten cards is only as wide as it needs to be. */
export function planTtsSheets(total: number): TtsSheetPlan[] {
  const plans: TtsSheetPlan[] = [];
  let left = Math.max(0, Math.floor(total));
  while (left > 0) {
    const count = Math.min(left, TTS_SHEET_MAX);
    const cols = Math.min(TTS_COLS, count);
    plans.push({ count, cols, rows: Math.ceil(count / cols) });
    left -= count;
  }
  return plans;
}

/** Pixel size of one grid cell: never larger than the card, and small enough that the whole sheet fits the texture limit. */
export function ttsCellSize(card: { w: number; h: number }, plan: Pick<TtsSheetPlan, 'cols' | 'rows'>, maxTexture = TTS_MAX_TEXTURE): { w: number; h: number } {
  const aspect = card.h / card.w;
  const byWidth = Math.floor(maxTexture / plan.cols);
  const byHeight = Math.floor(maxTexture / plan.rows / aspect);
  const w = Math.max(1, Math.min(card.w, byWidth, byHeight));
  return { w, h: Math.max(1, Math.floor(w * aspect)) };
}

/** One entry per physical card, so a card with three copies takes three slots. */
export function expandCopies<T extends { copies: number }>(items: T[]): T[] {
  return items.flatMap((item) => Array.from({ length: Math.max(0, Math.floor(item.copies)) }, () => item));
}

/** "trek-deck-<slug>-tts.jpg", "-tts-2of3.jpg" when the deck spans several sheets, "-tts-back.png" for the back. */
export function ttsFileName(slug: string, part: number | 'back', parts: number, ext: string): string {
  const base = `trek-deck-${slug || 'deck'}-tts`;
  if (part === 'back') return `${base}-back.${ext}`;
  return parts > 1 ? `${base}-${part}of${parts}.${ext}` : `${base}.${ext}`;
}
