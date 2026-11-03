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
}

export type ArtBox = [number, number, number, number];

export interface Template {
  type: CardType;
  family: Family;
  refWidthPt: number;
  artBox: ArtBox;
  boxes: Record<string, TextBox>;
  flow: Box & { sizePt: number; lineHeight: number };
  lore: { sizePt: number };
  skills?: { x0: number; y0: number; x1: number; rowHeight: number; bulletSize: number } | null;
  requirements?: (Box & { sizePt: number }) | null;
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
}

export interface IconDef {
  id: string;
  file: string;
  w: number;
  h: number;
}

export interface Catalog {
  generatedAt: string;
  templates: Record<string, Template>;
  icons: IconDef[];
  frames: Frame[];
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
