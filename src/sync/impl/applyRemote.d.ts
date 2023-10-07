import type { Database } from '../..'

import type { SyncConflictResolver, SyncDatabaseChangeSet, SyncLog } from '../index'

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
