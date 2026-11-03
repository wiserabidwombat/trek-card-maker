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
