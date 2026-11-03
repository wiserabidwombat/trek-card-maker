import { describe, it, expect } from 'vitest';
import { STANDARD_SKILLS, isStandardSkill, parseSkillText, skillText } from './skills';

describe('skills', () => {
  it('has the 23 standard skills in order', () => {
    expect(STANDARD_SKILLS).toHaveLength(23);
    expect(STANDARD_SKILLS[0]).toBe('Acquisition');
    expect(STANDARD_SKILLS[22]).toBe('Treachery');
    expect(isStandardSkill('Honor')).toBe(true);
    expect(isStandardSkill('Chef')).toBe(false);
  });

  it('formats counts', () => {
    expect(skillText({ name: 'Leadership', count: 2 })).toBe('2 Leadership');
    expect(skillText({ name: 'Leadership', count: 1 })).toBe('Leadership');
  });

  it('parses legacy text', () => {
    expect(parseSkillText('2 Treachery')).toEqual({ name: 'Treachery', count: 2 });
    expect(parseSkillText('Chef')).toEqual({ name: 'Chef', count: 1 });
    expect(parseSkillText('  3  Honor ')).toEqual({ name: 'Honor', count: 3 });
  });
});
