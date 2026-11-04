/**
 * Remembers when the deck was last exported as JSON and how many saves have happened since,
 * so the Cards column can nudge people before browser storage is their only copy for too long.
 */
const AT_KEY = 'trek-card-maker.backup.at';
const CHANGES_KEY = 'trek-card-maker.backup.changes';

/** Saves since the last export before the Cards column starts asking for a backup. */
export const NUDGE_AFTER = 20;

export interface BackupStatus {
  /** Epoch ms of the last JSON export, or null if there has never been one. */
  at: number | null;
  /** Card saves, imports and deletions since then. */
  changes: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: BackupStatus = readStatus();

function read(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the reminder just will not persist */
  }
}

function readStatus(): BackupStatus {
  const at = Number(read(AT_KEY));
  const changes = Number(read(CHANGES_KEY));
  return { at: at > 0 ? at : null, changes: Number.isFinite(changes) && changes > 0 ? Math.floor(changes) : 0 };
}

function emit(): void {
  snapshot = readStatus();
  for (const l of listeners) l();
}

export function backupStatus(): BackupStatus {
  return snapshot;
}

export function recordChange(count = 1): void {
  write(CHANGES_KEY, String(readStatus().changes + count));
  emit();
}

export function recordBackup(now = Date.now()): void {
  write(AT_KEY, String(now));
  write(CHANGES_KEY, '0');
  emit();
}

/** Subscribe to status changes; returns the unsubscribe function. */
export function subscribeBackup(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function needsNudge(s: BackupStatus): boolean {
  return s.changes >= NUDGE_AFTER;
}

/** One line for the Cards column, e.g. "Last backup yesterday · 3 changes since". */
export function describeBackup(s: BackupStatus, now = Date.now()): string {
  const changes = s.changes ? `${s.changes} change${s.changes === 1 ? '' : 's'}` : '';
  if (!s.at) return changes ? `Never backed up · ${changes}` : 'Never backed up';
  const days = Math.floor((now - s.at) / 86_400_000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `Last backup ${when}${changes ? ` · ${changes} since` : ''}`;
}
