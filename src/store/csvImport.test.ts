import { describe, it, expect } from 'vitest';
import { cardsFromRows, csvTemplate, parseDelimited, resolveFrame, resolveIcon } from './csvImport';
import type { Catalog, Frame } from '../catalog/types';

const frame = (id: string, type: Frame['type'], variant: string, label: string, affiliation = 'none', family: Frame['family'] = 'hires'): Frame =>
  ({ id, type, variant, label, affiliation, family, set: 's', sourceTitle: '', w: 10, h: 14, file: '', thumb: '', overlay: null, artBox: null, ring: null }) as unknown as Frame;

const catalog = {
  frames: [
    frame('personnel.klingon', 'personnel', 'klingon', 'Klingon', 'klingon'),
    frame('personnel.non-aligned', 'personnel', 'non-aligned', 'Non-Aligned', 'non-aligned'),
    frame('ship.klingon', 'ship', 'klingon', 'Klingon', 'klingon'),
    frame('mission.planet', 'mission', 'planet', 'Planet'),
    frame('mission.space', 'mission', 'space', 'Space'),
  ],
  icons: [
    { id: 'big-command', group: 'other' },
    { id: 'big-staff', group: 'other' },
    { id: 'mission-klingon', group: 'missionAffiliation' },
    { id: 'klingon', group: 'inline' },
  ],
  skills: [],
} as unknown as Catalog;

describe('parseDelimited', () => {
  it('reads quoted commas, doubled quotes and newlines, and drops blank rows', () => {
    const rows = parseDelimited('a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
      ['1', '2'],
    ]);
  });

  it('detects tab and semicolon separated text and strips a BOM', () => {
    expect(parseDelimited('﻿a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseDelimited('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('resolveFrame and resolveIcon', () => {
  it('matches frames by id, variant, label or affiliation and falls back to the first of the type', () => {
    expect(resolveFrame(catalog, 'personnel', 'Klingon').frame.id).toBe('personnel.klingon');
    expect(resolveFrame(catalog, 'personnel', 'non aligned').frame.id).toBe('personnel.non-aligned');
    expect(resolveFrame(catalog, 'mission', 'mission.space').frame.id).toBe('mission.space');
    expect(resolveFrame(catalog, 'mission', '')).toEqual({ frame: catalog.frames[3], matched: true });
    expect(resolveFrame(catalog, 'personnel', 'Tholian')).toEqual({ frame: catalog.frames[0], matched: false });
  });

  it('accepts icon ids or short names by card type', () => {
    expect(resolveIcon(catalog, 'personnel', 'command')).toBe('big-command');
    expect(resolveIcon(catalog, 'ship', 'big-staff')).toBe('big-staff');
    expect(resolveIcon(catalog, 'mission', 'Klingon')).toBe('mission-klingon');
    expect(resolveIcon(catalog, 'personnel', 'tribble')).toBeNull();
  });
});

describe('cardsFromRows', () => {
  it('builds cards of each type from the template', () => {
    const rows = parseDelimited(csvTemplate());
    const { cards, warnings } = cardsFromRows(rows, catalog, 'deck1');
    expect(warnings).toEqual([]);
    expect(cards.map((c) => c.type)).toEqual(['personnel', 'ship', 'mission']);
    const [worf, ship, mission] = cards;
    expect(worf.frameId).toBe('personnel.klingon');
    expect(worf.deckId).toBe('deck1');
    expect(worf.name).toBe('Worf');
    expect(worf.fields.unique).toBe('1');
    expect(worf.fields.strength).toBe('8');
    expect(worf.skills).toEqual([
      { name: 'Leadership', count: 2 },
      { name: 'Honor', count: 1 },
      { name: 'Security', count: 1 },
    ]);
    expect(worf.icons).toEqual(['big-command']);
    expect(worf.copies).toBe(2);
    expect(worf.fields.lore).toBe('"Today is a good day to die."');
    expect(ship.fields.staffing).toBe('command,staff');
    expect(ship.fields.shipClass).toBe("B'rel Class");
    expect(ship.skills).toEqual([]);
    expect(mission.frameId).toBe('mission.planet');
    expect(mission.icons).toEqual(['mission-klingon']);
    expect(mission.fields.quadrant).toBe('A');
    expect(mission.fields.requirements).toContain('Strength>34');
  });

  it('warns about unknown columns, frames and icons, skips unknown types, defaults missing type', () => {
    const rows = [
      ['Title', 'Frame', 'Icons', 'Mood'],
      ['Gowron', 'Tholian', 'command, tribble', 'grim'],
      ['Spock', 'Klingon', '', ''],
    ];
    const { cards, warnings } = cardsFromRows(rows, catalog);
    expect(cards).toHaveLength(2);
    expect(cards[0].type).toBe('personnel');
    expect(cards[0].icons).toEqual(['big-command']);
    expect(cards[0].copies).toBe(1);
    expect(warnings).toEqual([
      'Ignored column: Mood.',
      'No type column: every row became a personnel card.',
      'Row 2: no personnel frame called "Tholian", used Klingon.',
      'Row 2: no icon called "tribble".',
    ]);
    const bad = cardsFromRows([['type', 'title'], ['tribble', 'Fluffy']], catalog);
    expect(bad.cards).toEqual([]);
    expect(bad.warnings).toEqual(['Row 2: unknown type "tribble", skipped.']);
  });

  it('rejects files without a header and a title column', () => {
    expect(() => cardsFromRows([['type', 'title']], catalog)).toThrow(/header row and at least one card row/);
    expect(() => cardsFromRows([['type', 'cost'], ['personnel', '3']], catalog)).toThrow(/title/);
  });
});

describe('collector info and edge line columns', () => {
  it('builds the collector info from set, rarity and number', () => {
    const { cards } = cardsFromRows(
      [
        ['type', 'title', 'set', 'rarity', 'number', 'credit'],
        ['personnel', 'Worf', '25', 'v', '1', 'Fan-made card'],
        ['personnel', 'Martok', '25', '', '', ''],
      ],
      catalog,
    );
    expect(cards[0].fields.collectorInfo).toBe('25 V 1');
    expect(cards[0].fields.credit).toBe('Fan-made card');
    expect(cards[1].fields.collectorInfo).toBe('25');
  });

  it('prefers a collector column when both forms are present', () => {
    const { cards } = cardsFromRows(
      [
        ['type', 'title', 'collector', 'set', 'rarity', 'number'],
        ['personnel', 'Worf', '1 C 9', '25', 'V', '1'],
      ],
      catalog,
    );
    expect(cards[0].fields.collectorInfo).toBe('1 C 9');
  });

  it('ships set, rarity, number and credit columns in the template', () => {
    const header = parseDelimited(csvTemplate())[0];
    expect(header).toEqual(expect.arrayContaining(['set', 'rarity', 'number', 'credit']));
    expect(header).not.toContain('collector');
  });
});
