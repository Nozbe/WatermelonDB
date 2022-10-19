import type { Database } from '../..'

import type { SyncDatabaseChangeSet, SyncLog, SyncConflictResolver } from '../index'

export default function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
  _unsafeBatchPerCollection?: boolean,
): Promise<void>
