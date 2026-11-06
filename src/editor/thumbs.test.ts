import { describe, it, expect } from 'vitest';
import { pendingThumbs, pruneThumbs, thumbKey, type Thumb } from './thumbs';
import { newCard, type Card } from '../model/card';
import { DEFAULT_FONTS } from '../render/fonts';

const mk = (id: string, updatedAt = 1): Card => ({ ...newCard('personnel', 'personnel.klingon'), id, updatedAt });
const thumb = (card: Card): Thumb => ({ key: thumbKey(card, DEFAULT_FONTS), url: 'data:,', overflow: false });

describe('thumbKey', () => {
  it('changes with edits, frame, artwork and fonts', () => {
    const a = mk('a');
    const base = thumbKey(a, DEFAULT_FONTS);
    expect(thumbKey({ ...a, updatedAt: 2 }, DEFAULT_FONTS)).not.toBe(base);
    expect(thumbKey({ ...a, frameId: 'personnel.romulan' }, DEFAULT_FONTS)).not.toBe(base);
    expect(thumbKey({ ...a, image: { blobKey: 'img1', crop: { x: 0, y: 0, w: 1, h: 1 }, srcW: 1, srcH: 1 } }, DEFAULT_FONTS)).not.toBe(base);
    expect(thumbKey(a, { ...DEFAULT_FONTS, body: '"UserBody"' })).not.toBe(base);
    expect(thumbKey({ ...a, emblem: { icon: 'corner-borg' } }, DEFAULT_FONTS)).not.toBe(base);
    expect(thumbKey({ ...a, emblem: { blobKey: 'img-e' } }, DEFAULT_FONTS)).not.toBe(thumbKey({ ...a, emblem: { icon: 'corner-borg' } }, DEFAULT_FONTS));
    expect(thumbKey(a, DEFAULT_FONTS)).toBe(base);
  });
});

describe('pendingThumbs', () => {
  it('lists missing and stale cards, current card first', () => {
    const a = mk('a');
    const b = mk('b');
    const c = mk('c');
    const cache = new Map<string, Thumb>([
      ['a', thumb(a)],
      ['b', thumb({ ...b, updatedAt: 0 })],
    ]);
    expect(pendingThumbs([a, b, c], cache, DEFAULT_FONTS, null).map((x) => x.id)).toEqual(['b', 'c']);
    expect(pendingThumbs([a, b, c], cache, DEFAULT_FONTS, 'c').map((x) => x.id)).toEqual(['c', 'b']);
    expect(pendingThumbs([a], cache, DEFAULT_FONTS, 'a')).toEqual([]);
  });
});

describe('pruneThumbs', () => {
  it('forgets deleted cards and keeps the same map when nothing changed', () => {
    const a = mk('a');
    const cache = new Map<string, Thumb>([
      ['a', thumb(a)],
      ['gone', thumb(mk('gone'))],
    ]);
    const pruned = pruneThumbs([a], cache);
    expect([...pruned.keys()]).toEqual(['a']);
    expect(pruneThumbs([a], pruned)).toBe(pruned);
  });
});
