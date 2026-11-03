import type { Catalog } from '../catalog/types';
import { framesOfType, iconsInGroup } from '../catalog/types';
import { newCard, type Card } from '../model/card';
import { serializeDeck } from '../store/deckJson';

/**
 * Two example cards built against the live catalog, so the sample deck file always names real
 * frame and icon ids and imports without errors.
 */
export function sampleCards(catalog: Catalog): Card[] {
  const personnelFrame = framesOfType(catalog, 'personnel').find((f) => f.variant === 'klingon') ?? framesOfType(catalog, 'personnel')[0] ?? catalog.frames[0];
  const missionFrame = framesOfType(catalog, 'mission').find((f) => f.variant === 'planet') ?? framesOfType(catalog, 'mission')[0] ?? catalog.frames[0];
  const other = iconsInGroup(catalog, 'other').map((i) => i.id);
  const affiliations = iconsInGroup(catalog, 'missionAffiliation').map((i) => i.id);
  const pick = (ids: string[], wanted: string[]) => wanted.map((w) => ids.find((id) => id.endsWith(w))).filter((x): x is string => !!x);

  const worf = newCard(personnelFrame.type, personnelFrame.id);
  worf.id = 'sample-personnel';
  worf.name = 'Worf (sample)';
  worf.fields = {
    ...worf.fields,
    title: 'Worf',
    unique: '1',
    subtitle: 'Son of Mogh',
    species: 'Klingon',
    cost: '3',
    integrity: '6',
    cunning: '5',
    strength: '8',
    gameText: '**Order** - Stop this personnel to make another {icon:klingon} personnel present Strength +3 until the end of this turn.',
    lore: '"Today is a good day to die."',
    collectorInfo: '1 C 1',
  };
  worf.skills = [
    { name: 'Honor', count: 2 },
    { name: 'Leadership', count: 1 },
    { name: 'Security', count: 1 },
  ];
  worf.icons = pick(other, ['-command', '-deep-space-nine', '-past']);
  worf.updatedAt = 1;

  const qonos = newCard(missionFrame.type, missionFrame.id);
  qonos.id = 'sample-mission';
  qonos.name = "Qo'noS (sample)";
  qonos.fields = {
    ...qonos.fields,
    title: "Qo'noS",
    unique: '1',
    subtitle: 'Heart of the Empire',
    quadrant: 'B',
    points: '35',
    span: '2',
    requirements: 'Diplomacy, Honor, 2 Leadership, and Strength>34',
    gameText: 'When you complete this mission, you may download a {icon:klingon} ship.',
    lore: '"The Klingon homeworld."',
    collectorInfo: '1 C 2',
  };
  qonos.icons = pick(affiliations, ['-klingon', '-federation']);
  qonos.copies = 2;
  qonos.updatedAt = 2;

  return [worf, qonos];
}

/** The sample deck as it would be exported (no images; the `images` map is empty). */
export function sampleDeckJson(catalog: Catalog): string {
  return serializeDeck(sampleCards(catalog), {});
}
