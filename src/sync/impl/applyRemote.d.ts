import type { Database } from '../..'

import type { SyncDatabaseChangeSet, SyncLog, SyncConflictResolver } from '../index'

export default function applyRemoteChanges(
  remoteChanges: SyncDatabaseChangeSet,
  opts: {
    db: Database,
    sendCreatedAsUpdated: boolean,
    log?: SyncLog,
    conflictResolver?: SyncConflictResolver,
    _unsafeBatchPerCollection?: boolean,
  }
): Promise<void>
