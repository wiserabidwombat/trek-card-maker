import { describe, it, expect } from 'vitest';
import { isBlankCard, newCard } from './card';

describe('isBlankCard', () => {
  it('is true for a fresh card and one with only whitespace typed', () => {
    const c = newCard('personnel', 'personnel.klingon');
    expect(isBlankCard(c)).toBe(true);
    expect(isBlankCard({ ...c, fields: { ...c.fields, title: '  ' } })).toBe(true);
  });

  it('is false once any text, skill, icon, name or image is set', () => {
    const c = newCard('personnel', 'personnel.klingon');
    expect(isBlankCard({ ...c, fields: { ...c.fields, cost: '3' } })).toBe(false);
    expect(isBlankCard({ ...c, skills: [{ name: 'Honor', count: 1 }] })).toBe(false);
    expect(isBlankCard({ ...c, icons: ['big-command'] })).toBe(false);
    expect(isBlankCard({ ...c, name: 'Worf' })).toBe(false);
    expect(isBlankCard({ ...c, image: { blobKey: 'k', crop: { x: 0, y: 0, w: 1, h: 1 }, srcW: 1, srcH: 1, fill: '#000000' } })).toBe(false);
  });
});
