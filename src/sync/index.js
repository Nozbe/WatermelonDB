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
  setLastPulledSchemaVersion,
  hasUnsyncedChanges as hasUnsyncedChangesImpl,
  getMigrationInfo,
} from './impl'
import { ensureActionsEnabled, isChangeSetEmpty, ensureSameDatabase } from './impl/helpers'
import type { SchemaVersion } from '../Schema'
import { type MigrationSyncChanges } from '../Schema/migrations/getSyncChanges'

export type Timestamp = number

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

export type SyncPullArgs = $Exact<{
  lastPulledAt: ?Timestamp,
  schemaVersion: SchemaVersion,
  migration: MigrationSyncChanges,
}>
export type SyncPullResult = $Exact<{ changes: SyncDatabaseChangeSet, timestamp: Timestamp }>

export type SyncPushArgs = $Exact<{ changes: SyncDatabaseChangeSet, lastPulledAt: Timestamp }>

type SyncConflict = $Exact<{ local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw }>
export type SyncLog = {
  startedAt?: Date,
  lastPulledAt?: ?number,
  lastPulledSchemaVersion?: ?SchemaVersion,
  migration?: ?MigrationSyncChanges,
  newLastPulledAt?: number,
  resolvedConflicts?: SyncConflict[],
  finishedAt?: Date,
}

export type SyncConflictResolver = (
  table: TableName<any>,
  local: DirtyRaw,
  remote: DirtyRaw,
  resolved: DirtyRaw,
) => DirtyRaw

export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: SyncPullArgs => Promise<SyncPullResult>,
  pushChanges: SyncPushArgs => Promise<void>,
  // version at which support for migration syncs was added - the version BEFORE first syncable migration
  migrationsEnabledAtVersion?: SchemaVersion,
  sendCreatedAsUpdated?: boolean,
  log?: SyncLog,
  // Advanced (unsafe) customization point. Useful when you have subtle invariants between multiple
  // columns and want to have them updated consistently, or to implement partial sync
  // It's called for every record being updated locally, so be sure that this function is FAST.
  // If you don't want to change default behavior for a given record, return `resolved` as is
  // Note that it's safe to mutate `resolved` object, so you can skip copying it for performance.
  conflictResolver?: SyncConflictResolver,
  // commits changes in multiple batches, and not one - temporary workaround for memory issue
  _unsafeBatchPerCollection?: boolean,
}>

// See Sync docs for usage details

export async function synchronize({
  database,
  pullChanges,
  pushChanges,
  sendCreatedAsUpdated = false,
  useSequenceIds = false,
  migrationsEnabledAtVersion,
  log,
  conflictResolver,
  _unsafeBatchPerCollection,
}: SyncArgs): Promise<void> {
  ensureActionsEnabled(database)
  const resetCount = database._resetCount
  log && (log.startedAt = new Date())

  // TODO: Wrap the three computionally intensive phases in `requestIdleCallback`

  // pull phase
  const lastPulledAt = await getLastPulledAt(database, useSequenceIds)
  log && (log.lastPulledAt = lastPulledAt)

  const { schemaVersion, migration, shouldSaveSchemaVersion } = await getMigrationInfo(
    database,
    log,
    lastPulledAt,
    migrationsEnabledAtVersion,
  )

  const { changes: remoteChanges, timestamp: newLastPulledAt } = await pullChanges({
    lastPulledAt,
    schemaVersion,
    migration,
  })
  log && (log.newLastPulledAt = newLastPulledAt)

  await database.action(async action => {
    ensureSameDatabase(database, resetCount)

    await action.subAction(() =>
      applyRemoteChanges(
        database,
        remoteChanges,
        sendCreatedAsUpdated,
        log,
        conflictResolver,
        _unsafeBatchPerCollection,
      ),
    )
    await setLastPulledAt(database, newLastPulledAt, useSequenceIds)

    if (shouldSaveSchemaVersion) {
      await setLastPulledSchemaVersion(database, schemaVersion)
    }
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
