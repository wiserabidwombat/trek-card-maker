import { describe, it, expect } from 'vitest';
import { validateCatalog, CatalogError } from './loader';
import { templateFor, artBoxFor } from './types';

const minimal = {
  generatedAt: '2026-11-02',
  templates: {
    'dilemma.hires': {
      type: 'dilemma',
      family: 'hires',
      refWidthPt: 163.5,
      artBox: [0.02, 0.12, 0.95, 0.53],
      boxes: { title: { x0: 0.24, y0: 0.03, x1: 0.9, y1: 0.08, font: 'title', sizePt: 7.8, align: 'left' } },
      flow: { x0: 0.13, y0: 0.65, x1: 0.93, y1: 0.95, sizePt: 7, lineHeight: 0.032 },
      lore: { sizePt: 6.5 },
      skills: null,
      requirements: null,
    },
  },
  icons: [{ id: 'skill-dot', file: 'icons/skill-dot.png', w: 26, h: 26 }],
  frames: [
    {
      id: 'Set-001',
      set: 'Set',
      type: 'dilemma',
      family: 'hires',
      affiliation: 'none',
      sourceTitle: 'X',
      w: 1022,
      h: 1464,
      file: 'Set/001.jpg',
      thumb: 'Set/thumbs/001.jpg',
      overlay: 'overlays/dilemma.hires.none.png',
      artBox: [0.03, 0.12, 0.94, 0.52],
    },
  ],
};

describe('validateCatalog', () => {
  it('accepts a minimal valid catalog and resolves templates', () => {
    const c = validateCatalog(minimal);
    expect(c.frames).toHaveLength(1);
    const t = templateFor(c, c.frames[0]);
    expect(t.refWidthPt).toBe(163.5);
    expect(artBoxFor(c.frames[0], t)).toEqual([0.03, 0.12, 0.94, 0.52]);
  });

  it('falls back to the template art box when the frame has none', () => {
    const c = validateCatalog({ ...minimal, frames: [{ ...minimal.frames[0], artBox: null }] });
    expect(artBoxFor(c.frames[0], templateFor(c, c.frames[0]))).toEqual([0.02, 0.12, 0.95, 0.53]);
  });

  it('rejects a catalog without frames', () => {
    const { frames: _f, ...rest } = minimal;
    expect(() => validateCatalog(rest)).toThrow(CatalogError);
    expect(() => validateCatalog(rest)).toThrow(/frames/);
  });

  it('rejects a frame whose template is missing', () => {
    const bad = { ...minimal, frames: [{ ...minimal.frames[0], family: 'std' }] };
    expect(() => validateCatalog(bad)).toThrow(/Set-001/);
  });

  it('rejects non-object input', () => {
    expect(() => validateCatalog(null)).toThrow(CatalogError);
  });
});
