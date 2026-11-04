import { describe, it, expect } from 'vitest';
import { EMPTY_HISTORY, GROUP_MS, HISTORY_LIMIT, popRedo, popUndo, record, redoLabel, undoLabel } from './history';
import { newCard, type Card } from '../model/card';

const base = newCard('personnel', 'personnel.klingon');
const withTitle = (c: Card, title: string): Card => ({ ...c, fields: { ...c.fields, title } });

describe('history', () => {
  it('drops edits that change nothing', () => {
    expect(record(EMPTY_HISTORY, { kind: 'edit', before: base, after: { ...base }, at: 0 })).toBe(EMPTY_HISTORY);
  });

  it('merges a burst of edits on one card into a single step', () => {
    let h = record(EMPTY_HISTORY, { kind: 'edit', before: base, after: withTitle(base, 'W'), at: 0 });
    h = record(h, { kind: 'edit', before: withTitle(base, 'W'), after: withTitle(base, 'Wo'), at: 100 });
    h = record(h, { kind: 'edit', before: withTitle(base, 'Wo'), after: withTitle(base, 'Worf'), at: 200 });
    expect(h.undo).toHaveLength(1);
    expect(h.undo[0]).toMatchObject({ kind: 'edit', before: base, after: withTitle(base, 'Worf') });
    expect(undoLabel(h)).toBe('Undo edit');
  });

  it('starts a new step after a pause or on another card', () => {
    const other = newCard('ship', 'ship.klingon');
    let h = record(EMPTY_HISTORY, { kind: 'edit', before: base, after: withTitle(base, 'W'), at: 0 });
    h = record(h, { kind: 'edit', before: withTitle(base, 'W'), after: withTitle(base, 'Wo'), at: GROUP_MS + 1 });
    h = record(h, { kind: 'edit', before: other, after: withTitle(other, 'Vor'), at: GROUP_MS + 2 });
    expect(h.undo).toHaveLength(3);
  });

  it('a burst that ends where it started leaves no step', () => {
    let h = record(EMPTY_HISTORY, { kind: 'edit', before: base, after: withTitle(base, 'W'), at: 0 });
    h = record(h, { kind: 'edit', before: withTitle(base, 'W'), after: { ...base }, at: 50 });
    expect(h.undo).toHaveLength(0);
  });

  it('undo moves steps to redo, a new step clears redo, depth is capped', () => {
    let h = record(EMPTY_HISTORY, { kind: 'add', card: base, at: 0 });
    h = record(h, { kind: 'delete', card: base, index: 0, at: 5000 });
    const u = popUndo(h)!;
    expect(u.entry.kind).toBe('delete');
    expect(redoLabel(u.history)).toBe('Redo delete');
    const r = popRedo(u.history)!;
    expect(r.history.redo).toHaveLength(0);
    const cleared = record(u.history, { kind: 'reorder', before: ['a'], after: ['b'], at: 9000 });
    expect(cleared.redo).toHaveLength(0);
    let big = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) big = record(big, { kind: 'add', card: { ...base, id: String(i) }, at: i * 10_000 });
    expect(big.undo).toHaveLength(HISTORY_LIMIT);
    expect(popUndo(EMPTY_HISTORY)).toBeNull();
  });
});
