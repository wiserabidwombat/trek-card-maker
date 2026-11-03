import { describe, it, expect } from 'vitest';
import { newCard, changeType, typeBarText, displayTitle, COMMON_FIELDS, FIELD_DEFS, fieldsFor, staffingIcons, QUADRANTS } from './card';

describe('card model', () => {
  it('creates a card with every field initialised to an empty string', () => {
    const c = newCard('personnel', 'Set-001');
    const ids = [...COMMON_FIELDS, ...FIELD_DEFS.personnel].map((f) => f.id);
    for (const id of ids) expect(c.fields[id]).toBe('');
    expect(c.skills).toEqual([]);
    expect(c.copies).toBe(1);
    expect(c.frameId).toBe('Set-001');
    expect(c.type).toBe('personnel');
  });

  it('changeType keeps common fields and drops type-specific ones', () => {
    const c = newCard('personnel', 'A');
    c.fields.title = 'Worf';
    c.fields.species = 'Klingon';
    c.skills = [{ icon: 'skill-dot', text: 'Honor' }];
    const d = changeType(c, 'ship', 'B');
    expect(d.fields.title).toBe('Worf');
    expect(d.fields.species).toBeUndefined();
    expect(d.fields.shipClass).toBe('');
    expect(d.skills).toEqual([]);
    expect(d.frameId).toBe('B');
    expect(d.id).toBe(c.id);
  });

  it('typeBarText depends on the card type', () => {
    const p = newCard('personnel', 'A');
    p.fields.species = 'Bajoran';
    expect(typeBarText(p)).toBe('Bajoran');
    const s = newCard('ship', 'A');
    s.fields.shipClass = 'Galor Class';
    expect(typeBarText(s)).toBe('Galor Class');
    expect(typeBarText(newCard('dilemma', 'A'))).toBe('Dilemma');
    expect(typeBarText(newCard('interrupt', 'A'))).toBe('Interrupt');
    expect(typeBarText(newCard('mission', 'A'))).toBe('');
  });

  it('displayTitle prefixes a bullet for unique cards', () => {
    const c = newCard('event', 'A');
    c.fields.title = 'Dark Dissension';
    expect(displayTitle(c)).toBe('Dark Dissension');
    c.fields.unique = '1';
    expect(displayTitle(c)).toBe('•Dark Dissension');
  });

  it('fieldsFor lists common then type-specific fields', () => {
    const ids = fieldsFor('mission').map((f) => f.id);
    expect(ids.slice(0, COMMON_FIELDS.length)).toEqual(COMMON_FIELDS.map((f) => f.id));
    expect(ids).toContain('points');
    expect(ids).not.toContain('cost');
  });
});

describe('ship and mission extras', () => {
  it('parses staffing icon ids', () => {
    const s = newCard('ship', 'A');
    s.fields.staffing = 'command, staff,,staff ';
    expect(staffingIcons(s)).toEqual(['command', 'staff', 'staff']);
    expect(staffingIcons(newCard('ship', 'A'))).toEqual([]);
  });
  it('maps quadrant codes to Greek letters', () => {
    expect(QUADRANTS.A).toBe('Α');
    expect(QUADRANTS.D).toBe('Δ');
  });
});
