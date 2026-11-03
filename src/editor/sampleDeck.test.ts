import { describe, it, expect } from 'vitest';
import { sampleCards, sampleDeckJson } from './sampleDeck';
import { parseDeck } from '../store/deckJson';
import type { Catalog } from '../catalog/types';

const catalog = {
  frames: [
    { id: 'personnel.klingon', type: 'personnel', variant: 'klingon' },
    { id: 'personnel.federation', type: 'personnel', variant: 'federation' },
    { id: 'mission.planet', type: 'mission', variant: 'planet' },
  ],
  icons: [
    { id: 'big-command', group: 'other' },
    { id: 'big-past', group: 'other' },
    { id: 'mission-klingon', group: 'missionAffiliation' },
    { id: 'klingon', group: 'inline' },
  ],
  skills: [],
  templates: {},
  generatedAt: '',
} as unknown as Catalog;

describe('sample deck', () => {
  it('uses real frame and icon ids from the catalog', () => {
    const [worf, qonos] = sampleCards(catalog);
    expect(worf.frameId).toBe('personnel.klingon');
    expect(worf.icons).toEqual(['big-command', 'big-past']); // deep-space-nine is not in this catalog
    expect(qonos.frameId).toBe('mission.planet');
    expect(qonos.icons).toEqual(['mission-klingon']);
  });

  it('round-trips through the importer', () => {
    const { cards, images } = parseDeck(sampleDeckJson(catalog));
    expect(cards).toHaveLength(2);
    expect(cards[0].skills[0]).toEqual({ name: 'Honor', count: 2 });
    expect(cards[1].copies).toBe(2);
    expect(images).toEqual({});
  });
});
