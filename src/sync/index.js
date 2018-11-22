// @flow

import type { Database, RecordId, TableName, Model } from '..'
import { type DirtyRaw } from '../RawRecord'

import { applyRemoteChanges, fetchLocalChanges, markLocalChangesAsSynced } from './impl'

type Timestamp = number

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
  // TODO: Get lastSyncedAt
  const { changes: remoteChanges, timestamp } = await pullChanges({ lastSyncedAt: null })
  await applyRemoteChanges(database, remoteChanges)
  // TODO: Set lastSyncedAt

  const localChanges = await fetchLocalChanges(database)
  await pushChanges({ changes: localChanges.changes })
  await markLocalChangesAsSynced(database, localChanges)
}
