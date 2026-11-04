import { useSyncExternalStore } from 'react';
import { backupStatus, subscribeBackup, type BackupStatus } from '../store/backup';

export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribeBackup, backupStatus, backupStatus);
}
