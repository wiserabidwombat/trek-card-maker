import { describe, expect, it } from 'vitest';
import { newCard } from '../model/card';
import { STANDARD_SKILLS } from '../model/skills';
import { editDistance, lintCard, nearestSkill, plainText, type LintMessage } from './lint';

const ctx = { skills: STANDARD_SKILLS, keywords: ['Admiral', 'Commander', 'Thief'], icons: ['klingon', 'federation'] };

function personnel(fields: Record<string, string>) {
  const c = newCard('personnel', 'personnel.klingon');
  c.fields = { ...c.fields, title: 'Worf', cost: '3', integrity: '6', cunning: '5', strength: '8', species: 'Klingon', ...fields };
  return c;
}
const texts = (ms: LintMessage[]) => ms.map((m) => m.text);

describe('lintCard', () => {
  it('passes a well-formed personnel', () => {
    const c = personnel({ gameText: '**Order** – Stop this personnel to make another {icon:klingon} personnel present Strength +3 until the end of this turn.' });
    expect(lintCard(c, ctx)).toEqual([]);
  });

  it('flags missing title and numbers', () => {
    const c = personnel({ title: '', cost: '', strength: '' });
    const ms = lintCard(c, ctx);
    expect(ms).toContainEqual({ field: 'title', text: 'The title is empty.', level: 'warn' });
    expect(texts(ms)).toContain('Not filled in: Cost, Strength.');
  });

  it('checks the end and the start of game text', () => {
    expect(texts(lintCard(personnel({ gameText: 'stop this personnel' }), ctx))).toEqual([
      'Game text starts with a lowercase letter.',
      'Game text should end with a period.',
    ]);
    expect(texts(lintCard(personnel({ gameText: 'He said “no.”' }), ctx))).toEqual([]);
    expect(texts(lintCard(personnel({ gameText: 'Draw a card {icon:klingon}' }), ctx))).toEqual([]);
  });

  it('wants Order in bold with an en dash', () => {
    expect(texts(lintCard(personnel({ gameText: 'Order - Draw a card.' }), ctx))).toEqual(['Order prints in bold: **Order** –']);
    expect(texts(lintCard(personnel({ gameText: '**Order:** Draw a card.' }), ctx))).toEqual([
      'Order and Interrupt are followed by an en dash, not a colon: **Order** –',
    ]);
  });

  it('wants dilemma requirements in bold', () => {
    const c = newCard('dilemma', 'dilemma.space');
    c.fields = { ...c.fields, title: 'Test', cost: '2', gameText: 'Unless you have 2 Security and Cunning>30, all your personnel are stopped.' };
    expect(texts(lintCard(c, ctx))).toEqual(['Dilemma requirements print in bold: wrap the skills after “Unless you have” in **…**.']);
    c.fields.gameText = 'Unless you have **2 Security and Cunning>30**, all your personnel are stopped.';
    expect(lintCard(c, ctx)).toEqual([]);
  });

  it('spots lowercase skill names and near-miss spellings', () => {
    const ms = lintCard(personnel({ gameText: 'Randomly select a security personnel to be stopped.' }), ctx);
    expect(texts(ms)).toEqual(['Game text: “security” is a skill name; the cards capitalise skills (Security) and print them in bold when they are requirements.']);
    const m = newCard('mission', 'mission.planet');
    m.fields = { ...m.fields, title: 'Qo’noS', points: '35', span: '2', requirements: 'Diplomcy, Honor, and Strength>34' };
    expect(texts(lintCard(m, ctx))).toEqual([
      'Requirements: “Diplomcy” is not a skill; did you mean Diplomacy?',
      'Mission lore usually opens with the place in italics: *Qo’noS:* “…”',
    ].filter((t) => !t.startsWith('Mission lore')));
  });

  it('checks attribute comparisons, icons, markers and collector info', () => {
    const ms = lintCard(personnel({ gameText: 'While Cunning > 30, **this** personnel is {icon:kling0n} and {x}.', collectorInfo: 'one' }), ctx);
    expect(texts(ms)).toEqual([
      'Game text: no icon called “kling0n”.',
      'Game text: braces only make sense as {icon:id}.',
      'Game text: attribute comparisons print without spaces, Cunning>30.',
      'Collector info prints as set, rarity and number: 25 V 1.',
    ]);
    expect(texts(lintCard(personnel({ gameText: '**Admiral. Draw a card.' }), ctx))).toContain('Game text: a ** bold marker has no partner.');
  });

  it('asks for bold keywords at the start of the text', () => {
    expect(texts(lintCard(personnel({ gameText: 'Admiral. Draw a card.' }), ctx))).toEqual(['Keywords print in bold: **Admiral**']);
    expect(texts(lintCard(personnel({ gameText: 'Commander: U.S.S. Enterprise. Draw a card.' }), ctx))).toEqual(['Keywords print in bold: **Commander**']);
    expect(lintCard(personnel({ gameText: '**Admiral.** Draw a card.' }), ctx)).toEqual([]);
  });

  it('wants a place in italics before mission lore', () => {
    const m = newCard('mission', 'mission.planet');
    m.fields = { ...m.fields, title: 'Qo’noS', points: '35', span: '2', requirements: 'Diplomacy and Honor', lore: '"The Klingon homeworld."' };
    expect(texts(lintCard(m, ctx))).toEqual(['Mission lore usually opens with the place in italics: *Qo’noS:* “…”']);
    m.fields.lore = '*Qo’noS:* "The Klingon homeworld."';
    expect(lintCard(m, ctx)).toEqual([]);
  });
});

describe('helpers', () => {
  it('strips markup for plain text', () => {
    expect(plainText('**Order** – stop {icon:klingon} now')).toBe('Order – stop ⁠ now');
  });
  it('measures edit distance and finds near skills', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(nearestSkill('Diplomcy', STANDARD_SKILLS)).toBe('Diplomacy');
    expect(nearestSkill('Diplomacy', STANDARD_SKILLS)).toBeNull();
    expect(nearestSkill('Klingon', STANDARD_SKILLS)).toBeNull();
  });
});
