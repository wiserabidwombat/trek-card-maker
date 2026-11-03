import type { FontRole } from '../catalog/types';
import type { Style } from './textLayout';
import { bodyWeight } from './printProfile';
import type { TextSpec } from './textOps';

export interface FontConfig {
  title: string; // CSS family, quoted if needed
  body: string;
  /** Inkjet profile: Light -> Regular, Regular -> Medium. */
  heavier?: boolean;
}

export const DEFAULT_FONTS: FontConfig = { title: '"Exo 2"', body: '"Fira Sans Condensed"' };

export function cssFontForStyle(style: Style, sizePx: number, fonts: FontConfig): string {
  const weight = bodyWeight(style, !!fonts.heavier);
  return `${style.italic ? 'italic' : 'normal'} ${weight} ${sizePx}px ${fonts.body}`;
}

/** The font variant a body style resolves to (mirrors cssFontForStyle). */
export function specForStyle(style: Style, fonts: FontConfig): TextSpec {
  return { family: 'body', weight: bodyWeight(style, !!fonts.heavier), italic: !!style.italic };
}

/** The font variant a role resolves to (mirrors cssFont). */
export function specForRole(role: FontRole, fonts: FontConfig): TextSpec {
  switch (role) {
    case 'title':
      return { family: 'title', weight: 700, italic: true };
    case 'body':
      return specForStyle({ bold: false, italic: false }, fonts);
    case 'bodyBold':
    case 'bodyBoldSC':
      return specForStyle({ bold: true, italic: false }, fonts);
    case 'bodyItalic':
      return specForStyle({ bold: false, italic: true }, fonts);
    case 'bodyBoldItalic':
      return specForStyle({ bold: true, italic: true }, fonts);
    case 'bodyLightItalic':
      return specForStyle({ bold: false, italic: true, light: true }, fonts);
  }
}

export function cssFont(role: FontRole, sizePx: number, fonts: FontConfig): string {
  switch (role) {
    case 'title':
      return `italic 700 ${sizePx}px ${fonts.title}`;
    case 'body':
      return cssFontForStyle({ bold: false, italic: false }, sizePx, fonts);
    case 'bodyBold':
    case 'bodyBoldSC':
      return cssFontForStyle({ bold: true, italic: false }, sizePx, fonts);
    case 'bodyItalic':
      return cssFontForStyle({ bold: false, italic: true }, sizePx, fonts);
    case 'bodyBoldItalic':
      return cssFontForStyle({ bold: true, italic: true }, sizePx, fonts);
    case 'bodyLightItalic':
      return cssFontForStyle({ bold: false, italic: true, light: true }, sizePx, fonts);
  }
}

const STYLE_VARIANTS: Style[] = [
  { bold: false, italic: false },
  { bold: true, italic: false },
  { bold: false, italic: true },
  { bold: true, italic: true },
  { bold: false, italic: true, light: true },
];

export async function ensureFontsLoaded(fonts: FontConfig): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const specs = [
    cssFont('title', 40, fonts),
    ...STYLE_VARIANTS.map((s) => cssFontForStyle(s, 40, fonts)),
    ...STYLE_VARIANTS.map((s) => cssFontForStyle(s, 40, { ...fonts, heavier: true })),
  ];
  await Promise.all(
    specs.map((spec) =>
      document.fonts.load(spec).catch(() => {
        /* a missing variant falls back to a synthesised one */
      }),
    ),
  );
}

const userFamilies: Record<'title' | 'body', FontFace | null> = { title: null, body: null };

export async function registerUserFont(slot: 'title' | 'body', data: ArrayBuffer): Promise<string> {
  const family = slot === 'title' ? 'UserTitle' : 'UserBody';
  const prev = userFamilies[slot];
  if (prev) document.fonts.delete(prev);
  const face = new FontFace(family, data);
  await face.load();
  document.fonts.add(face);
  userFamilies[slot] = face;
  return `"${family}"`;
}

export function unregisterUserFont(slot: 'title' | 'body'): void {
  const prev = userFamilies[slot];
  if (prev) document.fonts.delete(prev);
  userFamilies[slot] = null;
}
