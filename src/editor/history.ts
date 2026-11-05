import type { Card } from '../model/card';

/** One undoable step. `at` is when it happened, used to group a burst of typing into one step. */
export type HistoryEntry =
  | { kind: 'edit'; before: Card; after: Card; at: number }
  | { kind: 'add'; card: Card; at: number }
  | { kind: 'delete'; card: Card; index: number; at: number }
  | { kind: 'reorder'; before: string[]; after: string[]; at: number }
  /** Several cards changed at once (numbering the deck, setting the edge line everywhere). */
  | { kind: 'bulk'; before: Card[]; after: Card[]; at: number };

export interface History {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export const EMPTY_HISTORY: History = { undo: [], redo: [] };
export const HISTORY_LIMIT = 50;
/** Edits to the same card closer together than this merge into one step. */
export const GROUP_MS = 1500;

function sameCard(a: Card, b: Card): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Record a step: no-op edits are dropped, bursts on one card merge, redo is cleared, depth is capped. */
export function record(h: History, entry: HistoryEntry): History {
  if (entry.kind === 'edit' && sameCard(entry.before, entry.after)) return h;
  const last = h.undo[h.undo.length - 1];
  if (entry.kind === 'edit' && last?.kind === 'edit' && last.after.id === entry.before.id && entry.at - last.at < GROUP_MS) {
    const merged: HistoryEntry = { kind: 'edit', before: last.before, after: entry.after, at: entry.at };
    if (sameCard(merged.before, merged.after)) return { undo: h.undo.slice(0, -1), redo: [] };
    return { undo: [...h.undo.slice(0, -1), merged], redo: [] };
  }
  const undo = [...h.undo, entry];
  return { undo: undo.length > HISTORY_LIMIT ? undo.slice(undo.length - HISTORY_LIMIT) : undo, redo: [] };
}

/** Move the newest step to the redo list and hand it back for applying. */
export function popUndo(h: History): { history: History; entry: HistoryEntry } | null {
  const entry = h.undo[h.undo.length - 1];
  if (!entry) return null;
  return { history: { undo: h.undo.slice(0, -1), redo: [...h.redo, entry] }, entry };
}

export function popRedo(h: History): { history: History; entry: HistoryEntry } | null {
  const entry = h.redo[h.redo.length - 1];
  if (!entry) return null;
  return { history: { undo: [...h.undo, entry], redo: h.redo.slice(0, -1) }, entry };
}

const LABELS: Record<HistoryEntry['kind'], string> = { edit: 'edit', add: 'new card', delete: 'delete', reorder: 'reorder', bulk: 'deck change' };

export function undoLabel(h: History): string | null {
  const e = h.undo[h.undo.length - 1];
  return e ? `Undo ${LABELS[e.kind]}` : null;
}

export function redoLabel(h: History): string | null {
  const e = h.redo[h.redo.length - 1];
  return e ? `Redo ${LABELS[e.kind]}` : null;
}

/** True when a keyboard event should be treated as an app-level undo/redo rather than the field's own. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
