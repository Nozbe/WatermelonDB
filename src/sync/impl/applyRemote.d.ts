import type { Database } from '../..'

import type {
  SyncDatabaseChangeSet,
  SyncLog,
  SyncShouldUpdateRecord,
  SyncConflictResolver,
} from '../index'

export default function applyRemoteChanges(
  remoteChanges: SyncDatabaseChangeSet,
  opts: {
    db: Database,
    sendCreatedAsUpdated: boolean,
    log?: SyncLog,
    shouldUpdateRecord?: SyncShouldUpdateRecord,
    conflictResolver?: SyncConflictResolver,
    _unsafeBatchPerCollection?: boolean,
  }
): Promise<void>
