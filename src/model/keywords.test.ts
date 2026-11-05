import { describe, expect, it } from 'vitest';
import { CARD_TYPES } from '../catalog/types';
import { KEYWORDS, keywordInsert, keywordText, keywordsFor } from './keywords';

describe('keywords', () => {
  it('prints plain keywords in bold with a period, as the cards do', () => {
    expect(keywordText({ name: 'Admiral', types: ['personnel'] })).toBe('**Admiral.** ');
  });

  it('keeps a value inside the bold', () => {
    expect(keywordText({ name: 'Commander', types: ['personnel'], value: 'ship' }, 'U.S.S. Defiant')).toBe('**Commander: U.S.S. Defiant.** ');
    expect(keywordText({ name: 'Consume', types: ['dilemma'], value: 'number' }, '2')).toBe('**Consume: 2.** ');
  });

  it('puts the caret where the value goes', () => {
    const ins = keywordInsert({ name: 'Commander', types: ['personnel'], value: 'ship' });
    expect(ins.text).toBe('**Commander: .** ');
    expect(ins.text.slice(0, ins.caret)).toBe('**Commander: ');
    const plain = keywordInsert({ name: 'Thief', types: ['personnel'] });
    expect(plain.caret).toBe(plain.text.length);
  });

  it('offers each card type its own keywords, every keyword to some type', () => {
    expect(keywordsFor('personnel').map((k) => k.name)).toContain('Thief');
    expect(keywordsFor('dilemma').map((k) => k.name)).toEqual(['Consume']);
    expect(keywordsFor('mission').map((k) => k.name)).toEqual(['Nebula', 'Region']);
    for (const k of KEYWORDS) expect(k.types.every((t) => CARD_TYPES.includes(t))).toBe(true);
    expect(new Set(KEYWORDS.map((k) => k.name)).size).toBe(KEYWORDS.length);
  });
});
