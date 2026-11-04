import { describe, it, expect, beforeEach } from 'vitest';
import { backupStatus, describeBackup, needsNudge, NUDGE_AFTER, recordBackup, recordChange, subscribeBackup } from './backup';

const DAY = 86_400_000;

describe('backup reminder', () => {
  beforeEach(() => {
    localStorage.clear();
    recordBackup(0); // resets the counter; at=0 reads back as "never"
  });

  it('starts as never backed up with no changes', () => {
    expect(backupStatus()).toEqual({ at: null, changes: 0 });
    expect(describeBackup(backupStatus())).toBe('Never backed up');
  });

  it('counts saves and resets on export', () => {
    recordChange();
    recordChange(3);
    expect(backupStatus().changes).toBe(4);
    recordBackup(1_000);
    expect(backupStatus()).toEqual({ at: 1_000, changes: 0 });
  });

  it('nudges once enough has changed since the last export', () => {
    expect(needsNudge({ at: null, changes: NUDGE_AFTER - 1 })).toBe(false);
    expect(needsNudge({ at: null, changes: NUDGE_AFTER })).toBe(true);
    expect(needsNudge({ at: 5, changes: NUDGE_AFTER + 10 })).toBe(true);
  });

  it('describes the last backup in days', () => {
    const now = 10 * DAY;
    expect(describeBackup({ at: now - 1000, changes: 0 }, now)).toBe('Last backup today');
    expect(describeBackup({ at: now - DAY, changes: 1 }, now)).toBe('Last backup yesterday · 1 change since');
    expect(describeBackup({ at: now - 3 * DAY, changes: 7 }, now)).toBe('Last backup 3 days ago · 7 changes since');
    expect(describeBackup({ at: null, changes: 2 }, now)).toBe('Never backed up · 2 changes');
  });

  it('notifies subscribers', () => {
    let calls = 0;
    const off = subscribeBackup(() => calls++);
    recordChange();
    recordBackup(42);
    off();
    recordChange();
    expect(calls).toBe(2);
  });
});
