import { describe, it, expect } from 'vitest';
import { renderErrorHint } from './errors';

describe('renderErrorHint', () => {
  it('explains fetch failures with the dev-server hint', () => {
    expect(renderErrorHint('Failed to load image /frames/base/ship.federation.jpg')).toMatch(/npm run dev/);
  });
  it('points at the frame picker for unknown frames', () => {
    expect(renderErrorHint('Frame personnel.x is not in the catalog')).toMatch(/another frame/);
  });
  it('stays quiet for anything else', () => {
    expect(renderErrorHint('something odd')).toBe('');
  });
});
