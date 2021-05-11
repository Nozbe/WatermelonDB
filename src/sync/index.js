// @flow

import type { Database, RecordId, TableName, Model } from '..'
import { type DirtyRaw } from '../RawRecord'
import type { Clause } from '../QueryDescription'

import { hasUnsyncedChanges as hasUnsyncedChangesImpl } from './impl'
import type { SchemaVersion } from '../Schema'
import { type MigrationSyncChanges } from '../Schema/migrations/getSyncChanges'

export type Timestamp = number

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = { [TableName<any>]: SyncTableChangeSet }

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
  remoteChangeCount?: number,
  localChangeCount?: number,
  phase?: string, // NOTE: an textual information, not a stable API!
  error?: Error,
}

export type SyncConflictResolver = (
  table: TableName<any>,
  local: DirtyRaw,
  remote: DirtyRaw,
  resolved: DirtyRaw,
) => DirtyRaw

export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: (SyncPullArgs) => Promise<SyncPullResult>,
  pushChangesCreatedQueries?: Clause[],
  pushChangesUpdatedQueries?: Clause[],
  pushChangesDeletedQueries?: Clause[],
  pushChanges?: (SyncPushArgs) => Promise<void>,
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

export async function synchronize(args: SyncArgs): Promise<void> {
  try {
    const synchronizeImpl = require('./impl/synchronize').default
    await synchronizeImpl(args)
  } catch (error) {
    args.log && (args.log.error = error)
    throw error
  }
}

export async function hasUnsyncedChanges({
  database,
}: $Exact<{ database: Database }>): Promise<boolean> {
  return hasUnsyncedChangesImpl(database)
}
