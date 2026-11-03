import type { Catalog, Frame, Template } from './types';
import { templateKey } from './types';

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function need(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new CatalogError(msg);
}

function checkTemplate(key: string, t: unknown): Template {
  need(isRecord(t), `templates.${key} must be an object`);
  need(typeof t.refWidthPt === 'number', `templates.${key}.refWidthPt must be a number`);
  need(Array.isArray(t.artBox) && t.artBox.length === 4, `templates.${key}.artBox must have 4 numbers`);
  need(isRecord(t.boxes), `templates.${key}.boxes must be an object`);
  need(isRecord(t.flow), `templates.${key}.flow must be an object`);
  need(isRecord(t.lore), `templates.${key}.lore must be an object`);
  return t as unknown as Template;
}

function checkFrame(i: number, f: unknown, templates: Record<string, Template>): Frame {
  need(isRecord(f), `frames[${i}] must be an object`);
  for (const k of ['id', 'set', 'type', 'family', 'affiliation', 'file', 'thumb']) {
    need(typeof f[k] === 'string', `frames[${i}].${k} must be a string`);
  }
  need(typeof f.w === 'number' && typeof f.h === 'number', `frames[${i}] needs numeric w and h`);
  const frame = f as unknown as Frame;
  need(templateKey(frame) in templates, `frame ${frame.id} has no template ${templateKey(frame)}`);
  return {
    ...frame,
    sourceTitle: typeof f.sourceTitle === 'string' ? f.sourceTitle : '',
    overlay: typeof f.overlay === 'string' ? f.overlay : null,
    artBox: Array.isArray(f.artBox) && f.artBox.length === 4 ? (f.artBox as Frame['artBox']) : null,
  };
}

export function validateCatalog(json: unknown): Catalog {
  need(isRecord(json), 'catalog must be an object');
  need(isRecord(json.templates), 'catalog.templates must be an object');
  need(Array.isArray(json.frames), 'catalog.frames must be an array');
  need(Array.isArray(json.icons), 'catalog.icons must be an array');
  const templates: Record<string, Template> = {};
  for (const [key, t] of Object.entries(json.templates)) templates[key] = checkTemplate(key, t);
  const frames = json.frames.map((f, i) => checkFrame(i, f, templates));
  const icons = json.icons.map((ic, i) => {
    need(isRecord(ic) && typeof ic.id === 'string' && typeof ic.file === 'string', `icons[${i}] invalid`);
    return { id: ic.id, file: ic.file, w: Number(ic.w) || 0, h: Number(ic.h) || 0 };
  });
  return {
    generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : '',
    templates,
    icons,
    frames,
  };
}
