// @flow

import { invariant } from '../utils/common'
import type { Database, RecordId, TableName, Model } from '..'
import { type DirtyRaw } from '../RawRecord'

import {
  applyRemoteChanges,
  fetchLocalChanges,
  markLocalChangesAsSynced,
  getLastSyncedAt,
  setLastSyncedAt,
} from './impl'

export type Timestamp = number

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

export type SyncPullArgs = $Exact<{ lastSyncedAt: ?Timestamp }>
export type SyncPullResult = $Exact<{ changes: SyncDatabaseChangeSet, timestamp: Timestamp }>

export type SyncPushArgs = $Exact<{ changes: SyncDatabaseChangeSet }>

export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: SyncPullArgs => Promise<SyncPullResult>,
  pushChanges: SyncPushArgs => Promise<void>,
}>

export async function synchronize({ database, pullChanges, pushChanges }: SyncArgs): Promise<void> {
  const lastSyncedAt = await getLastSyncedAt(database)
  const { changes: remoteChanges, timestamp } = await pullChanges({ lastSyncedAt })
  await database.action(async action => {
    invariant(
      lastSyncedAt === (await getLastSyncedAt(database)),
      '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
    )
    action.subAction(() => applyRemoteChanges(database, remoteChanges))
    await setLastSyncedAt(database, timestamp)
  })

  const localChanges = await fetchLocalChanges(database)
  await pushChanges({ changes: localChanges.changes })
  await markLocalChangesAsSynced(database, localChanges)
}
