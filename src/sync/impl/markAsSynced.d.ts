import type { Database, Model, TableName } from '../..'

import type { SyncLocalChanges, SyncRejectedIds } from '../index'

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
  rejectedIds?: SyncRejectedIds,
): Promise<void>