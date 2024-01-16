// @flow

import type { Database, RecordId, TableName, Model } from '..'
import type { Where } from '../QueryDescription'
import { type DirtyRaw } from '../RawRecord'

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
export type SyncPullStrategyType =
  // Standard sync strategy (default)
  | 'incremental'
  // Advanced alternative strategy: indicates that `changes` contains a full dataset (same as during
  // initial sync). Local records not present in the changeset will be deleted. Other records will be
  // applied as usual (created, updated, local update conflicts resolved).
  // This is useful to recover from a corrupted local database, or to deal with very large state changes
  // such that server doesn't know how to efficiently send incremental changes and wants to send a full
  // changeset instead.
  // See docs for more details.
  | 'replacement'
export type SyncPullStrategy =
  | SyncPullStrategyType
  | $Exact<{
      default: SyncPullStrategyType,
      override: { [TableName<any>]: SyncPullStrategyType },
      experimentalQueryRecordsForReplacement?: {
        [TableName<any>]: () => Where[],
      },
    }>

export type SyncPullResult =
  | $Exact<{
      changes: SyncDatabaseChangeSet,
      timestamp: Timestamp,
      experimentalStrategy?: SyncPullStrategy,
    }>
  | $Exact<{ syncJson: string }>
  | $Exact<{ syncJsonId: number }>

export type SyncRejectedIds = { [TableName<any>]: RecordId[] }

export type SyncPushArgs = $Exact<{ changes: SyncDatabaseChangeSet, lastPulledAt: Timestamp }>

export type SyncPushResult = $Exact<{ experimentalRejectedIds?: SyncRejectedIds }>

type SyncConflict = $Exact<{ local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw }>
export type SyncLog = {
  startedAt?: Date,
  lastPulledAt?: ?number,
  lastPulledSchemaVersion?: ?SchemaVersion,
  migration?: ?MigrationSyncChanges,
  newLastPulledAt?: number,
  resolvedConflicts?: SyncConflict[],
  rejectedIds?: SyncRejectedIds,
  finishedAt?: Date,
  remoteChangeCount?: number,
  localChangeCount?: number,
  phase?: string, // NOTE: an textual information, not a stable API!
  error?: Error,
}

export type SyncShouldUpdateRecord = (
  table: TableName<any>,
  local: DirtyRaw,
  remote: DirtyRaw,
) => boolean

export type SyncConflictResolver = (
  table: TableName<any>,
  local: DirtyRaw,
  remote: DirtyRaw,
  resolved: DirtyRaw,
) => DirtyRaw

// TODO: JSDoc'ify this
export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: (SyncPullArgs) => Promise<SyncPullResult>,
  pushChanges?: (SyncPushArgs) => Promise<?SyncPushResult>,
  // version at which support for migration syncs was added - the version BEFORE first syncable migration
  migrationsEnabledAtVersion?: SchemaVersion,
  sendCreatedAsUpdated?: boolean,
  log?: SyncLog,
  // Advanced (unsafe) customization point. Useful when doing per record conflict resolution and can
  // determine directly from remote and local if we can keep local.
  shouldUpdateRecord?: SyncShouldUpdateRecord,
  // Advanced (unsafe) customization point. Useful when you have subtle invariants between multiple
  // columns and want to have them updated consistently, or to implement partial sync
  // It's called for every record being updated locally, so be sure that this function is FAST.
  // If you don't want to change default behavior for a given record, return `resolved` as is
  // Note that it's safe to mutate `resolved` object, so you can skip copying it for performance.
  conflictResolver?: SyncConflictResolver,
  // commits changes in multiple batches, and not one - temporary workaround for memory issue
  _unsafeBatchPerCollection?: boolean,
  // Advanced optimization - pullChanges must return syncJson or syncJsonId to be processed by native code.
  // This can only be used on initial (login) sync, not for incremental syncs.
  // This can only be used with SQLiteAdapter with JSI enabled.
  // The exact API may change between versions of WatermelonDB.
  // See documentation for more details.
  unsafeTurbo?: boolean,
  // Called after changes are pulled with whatever was returned by pullChanges, minus `changes`. Useful
  // when using turbo mode
  onDidPullChanges?: (Object) => Promise<void>,
  // Called after pullChanges is done, but before these changes are applied. Some stats about the pulled
  // changes are passed as arguments. An advanced user can use this for example to show some UI to the user
  // when processing a very large sync (could be useful for replacement syncs). Note that remote change count
  // is NaN in turbo mode.
  onWillApplyRemoteChanges?: (info: $Exact<{ remoteChangeCount: number }>) => Promise<void>,
}>

/**
 * Synchronizes database with a remote server
 *
 * See docs for more details
 */
export async function synchronize(args: SyncArgs): Promise<void> {
  try {
    const synchronizeImpl = require('./impl/synchronize').default
    await synchronizeImpl(args)
  } catch (error) {
    args.log && (args.log.error = error)
    throw error
  }
}

/**
 * Returns `true` if database has any unsynced changes.
 *
 * Use this to check if you can safely log out (delete the database)
 */
export function hasUnsyncedChanges({ database }: $Exact<{ database: Database }>): Promise<boolean> {
  return require('./impl').hasUnsyncedChanges(database)
}
