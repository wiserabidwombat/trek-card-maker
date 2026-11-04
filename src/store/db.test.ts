import { describe, it, expect } from 'vitest';
import { isCardOrImageKey } from './db';

describe('isCardOrImageKey', () => {
  it('matches card and image keys only', () => {
    expect(isCardOrImageKey('card:abc')).toBe(true);
    expect(isCardOrImageKey('img-123')).toBe(true);
    expect(isCardOrImageKey('font:title')).toBe(false);
    expect(isCardOrImageKey('settings')).toBe(false);
    expect(isCardOrImageKey(42)).toBe(false);
  });
});

describe('orphanImageKeys', () => {
  it('lists image keys no card references', async () => {
    const { orphanImageKeys } = await import('./db');
    const cards = [{ image: { blobKey: 'img-keep', crop: { x: 0, y: 0, w: 1, h: 1 }, srcW: 1, srcH: 1 } }, { image: undefined }];
    expect(orphanImageKeys(['img-keep', 'img-old', 'card:1', 'font:title', 7], cards)).toEqual(['img-old']);
  });
});
