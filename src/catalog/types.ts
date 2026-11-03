export type CardType = 'personnel' | 'ship' | 'equipment' | 'event' | 'interrupt' | 'mission' | 'dilemma';
export const CARD_TYPES: CardType[] = ['personnel', 'ship', 'equipment', 'event', 'interrupt', 'mission', 'dilemma'];

export type Family = 'hires' | 'std';

export type FontRole =
  | 'title'
  | 'body'
  | 'bodyBold'
  | 'bodyItalic'
  | 'bodyBoldItalic'
  | 'bodyLightItalic'
  | 'bodyBoldSC';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextBox extends Box {
  font: FontRole;
  sizePt: number;
  align: 'left' | 'center' | 'right';
  /** Text colour printed on the originals ("#rrggbb"); black when absent. */
  colour?: string;
}

export type ArtBox = [number, number, number, number];

/** A socket in the icon column: centre and ring diameter as fractions (size relative to width). */
export interface IconSlot {
  cx: number;
  cy: number;
  size: number;
}

/** Mission affiliation strip: icons centred on the card at cy, every `step`, `size` wide (fractions of W/H). */
export interface MissionStrip {
  cy: number;
  step: number;
  size: number;
}

export interface Template {
  type: CardType;
  family: Family;
  refWidthPt: number;
  artBox: ArtBox;
  boxes: Record<string, TextBox>;
  flow: Box & { sizePt: number; lineHeight: number; colour?: string };
  lore: { sizePt: number };
  skills?: { x0: number; y0: number; x1: number; rowHeight: number; bulletSize: number; colour?: string } | null;
  requirements?: (Box & { sizePt: number; colour?: string }) | null;
  /** Ship staffing icon slots: centred at cx, first at y0, then every `step`; icon width `size` (fractions). */
  staffing?: { cx: number; y0: number; step: number; size: number; max: number } | null;
  /** Mission quadrant badge: disc centre/radius (fractions of width for r) and the letter size. */
  quadrant?: { cx: number; cy: number; r: number; fill: string; sizePt: number } | null;
  /** Other Icons sockets (personnel, ship), top to bottom. */
  iconSlots?: IconSlot[] | null;
  /** Mission affiliation icon strip geometry. */
  missionAffiliations?: MissionStrip | null;
  /** Black card border drawn around the frame image (PDF points); 0 when the image already has it. */
  card?: { borderPt: number; cornerPt: number } | null;
}

export interface Frame {
  id: string;
  set: string;
  type: CardType;
  family: Family;
  affiliation: string;
  sourceTitle: string;
  w: number;
  h: number;
  file: string;
  thumb: string;
  overlay: string | null;
  artBox: ArtBox | null;
  /** Affiliation, mission type, dilemma type or 'default'. */
  variant: string;
  label: string;
  /** Empty socket ring drawn under each Other Icon (personnel, ship). */
  ring: string | null;
}

export type IconGroup = 'inline' | 'other' | 'missionAffiliation';

export interface IconDef {
  id: string;
  file: string;
  w: number;
  h: number;
  group: IconGroup;
  /** Composed high-resolution twin of a small inline icon, used wherever the icon is drawn. */
  hi?: string | null;
}

export interface Catalog {
  generatedAt: string;
  templates: Record<string, Template>;
  icons: IconDef[];
  frames: Frame[];
  /** Standard skill names, as found in the source cards. */
  skills: string[];
}

export function framesOfType(c: Catalog, type: CardType): Frame[] {
  return c.frames.filter((f) => f.type === type);
}

export function iconsInGroup(c: Catalog, group: IconGroup): IconDef[] {
  return c.icons.filter((i) => i.group === group);
}

export function templateKey(f: Pick<Frame, 'type' | 'family'>): string {
  return `${f.type}.${f.family}`;
}

export function templateFor(c: Catalog, f: Frame): Template {
  const t = c.templates[templateKey(f)];
  if (!t) throw new Error(`No template for frame ${f.id} (${templateKey(f)})`);
  return t;
}

export function artBoxFor(f: Frame, t: Template): ArtBox {
  return f.artBox ?? t.artBox;
}
