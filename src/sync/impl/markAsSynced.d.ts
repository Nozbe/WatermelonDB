import type { Database, Model, TableName } from '../..'

import type { SyncLocalChanges, SyncIds } from '../index'

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
  allowOnlyAcceptedIds: boolean,
  rejectedIds?: SyncIds,
  allAcceptedIds?: SyncIds,
): Promise<void>
