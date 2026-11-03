/** The 23 Second Edition skills, as printed on cards. */
export const STANDARD_SKILLS: readonly string[] = [
  'Acquisition',
  'Anthropology',
  'Archaeology',
  'Astrometrics',
  'Biology',
  'Diplomacy',
  'Engineer',
  'Exobiology',
  'Geology',
  'Honor',
  'Intelligence',
  'Law',
  'Leadership',
  'Medical',
  'Navigation',
  'Officer',
  'Physics',
  'Programming',
  'Science',
  'Security',
  'Telepathy',
  'Transporters',
  'Treachery',
];

export interface Skill {
  name: string;
  count: number;
}

export function isStandardSkill(name: string, list: readonly string[] = STANDARD_SKILLS): boolean {
  return list.includes(name);
}

/** "2 Leadership" for multiples, the bare name otherwise. */
export function skillText(s: Skill): string {
  const name = s.name.trim();
  return s.count > 1 ? `${s.count} ${name}` : name;
}

/** Inverse of skillText: "2 Treachery" → {Treachery, 2}; "Chef" → {Chef, 1}. */
export function parseSkillText(text: string): Skill {
  const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(text);
  if (m) return { name: m[2], count: Math.max(1, Number(m[1])) };
  return { name: text.trim(), count: 1 };
}
