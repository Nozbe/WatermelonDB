import type { Database, Model, TableName } from '../..'

import type { SyncLocalChanges, SyncIds, SyncConflictResolver, SyncPushResultSet } from '../index'

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
  allowOnlyAcceptedIds: boolean,
  rejectedIds?: SyncIds,
  allAcceptedIds?: SyncIds,
  pushConflictResolver?: SyncConflictResolver,
  remoteDirtyRaws?: SyncPushResultSet,
): Promise<void>
