// @flow

import { invariant } from '../utils/common'
import type { Database, RecordId, TableName, Model } from '..'
import { type DirtyRaw } from '../RawRecord'

import {
  applyRemoteChanges,
  fetchLocalChanges,
  markLocalChangesAsSynced,
  getLastPulledAt,
  setLastPulledAt,
  hasUnsyncedChanges as hasUnsyncedChangesImpl,
} from './impl'
import { ensureActionsEnabled, ensureSameDatabase, isChangeSetEmpty } from './impl/helpers'

export type Timestamp = number

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

export type SyncPullArgs = $Exact<{ lastPulledAt: ?Timestamp }>
export type SyncPullResult = $Exact<{ changes: SyncDatabaseChangeSet, timestamp: Timestamp }>

export type SyncPushArgs = $Exact<{ changes: SyncDatabaseChangeSet, lastPulledAt: Timestamp }>

type SyncConflict = $Exact<{ local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw }>
export type SyncLog = {
  startedAt?: Date,
  lastPulledAt?: ?number,
  newLastPulledAt?: number,
  resolvedConflicts?: SyncConflict[],
  finishedAt?: Date,
}

export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: SyncPullArgs => Promise<SyncPullResult>,
  pushChanges: SyncPushArgs => Promise<void>,
  sendCreatedAsUpdated?: boolean,
  log?: SyncLog,
  _unsafeBatchPerCollection?: boolean, // commits changes in multiple batches, and not one - temporary workaround for memory issue
}>

// See Sync docs for usage details

export async function synchronize({
  database,
  pullChanges,
  pushChanges,
  sendCreatedAsUpdated = false,
  log,
  _unsafeBatchPerCollection,
}: SyncArgs): Promise<void> {
  ensureActionsEnabled(database)
  const resetCount = database._resetCount
  log && (log.startedAt = new Date())

  // TODO: Wrap the three computionally intensive phases in `requestIdleCallback`

  // pull phase
  const lastPulledAt = await getLastPulledAt(database)
  log && (log.lastPulledAt = lastPulledAt)

  const { changes: remoteChanges, timestamp: newLastPulledAt } = await pullChanges({ lastPulledAt })
  log && (log.newLastPulledAt = newLastPulledAt)

  await database.action(async action => {
    ensureSameDatabase(database, resetCount)
    invariant(
      lastPulledAt === (await getLastPulledAt(database)),
      '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
    )
    await action.subAction(() =>
      applyRemoteChanges(
        database,
        remoteChanges,
        sendCreatedAsUpdated,
        log,
        _unsafeBatchPerCollection,
      ),
    )
    await setLastPulledAt(database, newLastPulledAt)
  }, 'sync-synchronize-apply')

  // push phase
  const localChanges = await fetchLocalChanges(database)

  ensureSameDatabase(database, resetCount)
  if (!isChangeSetEmpty(localChanges.changes)) {
    await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })

    ensureSameDatabase(database, resetCount)
    await markLocalChangesAsSynced(database, localChanges)
  }

  log && (log.finishedAt = new Date())
}

export async function hasUnsyncedChanges({
  database,
}: $Exact<{ database: Database }>): Promise<boolean> {
  return hasUnsyncedChangesImpl(database)
}
