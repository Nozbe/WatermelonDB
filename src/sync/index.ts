import {invariant} from '../utils/common';
import type { Database, RecordId, TableName, Model } from '..'
import { DirtyRaw } from '../RawRecord'

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
import { ensureActionsEnabled, isChangeSetEmpty, isSameDatabase } from './impl/helpers'
import type { SchemaVersion } from '../Schema'
import { MigrationSyncChanges } from '../Schema/migrations/getSyncChanges'

export type Timestamp = number;

export type SyncTableChangeSet = {
  created: DirtyRaw[];
  updated: DirtyRaw[];
  deleted: RecordId[];
};
export type SyncDatabaseChangeSet = Map<string, SyncTableChangeSet>;

export type SyncLocalChanges = {
  changes: SyncDatabaseChangeSet;
  affectedRecords: Model[];
};

export type SyncPullArgs = {
  lastPulledAt: Timestamp | null | undefined | string;
  schemaVersion: SchemaVersion;
  migration: MigrationSyncChanges;
};
export type SyncPullResult = {
  changes: SyncDatabaseChangeSet;
  timestamp: Timestamp;
};

export type SyncPushArgs = {
  changes: SyncDatabaseChangeSet;
  lastPulledAt: Timestamp;
};

type SyncConflict = {
  local: DirtyRaw;
  remote: DirtyRaw;
  resolved: DirtyRaw;
};
export type SyncLog = {
  startedAt?: Date;
  lastPulledAt?: number | null | undefined | string;
  lastPulledSchemaVersion?: SchemaVersion | null | undefined;
  migration?: MigrationSyncChanges | null | undefined;
  newLastPulledAt?: number;
  resolvedConflicts?: SyncConflict[];
  finishedAt?: Date;
};

export type SyncConflictResolver = (
  table: TableName<any>,
  local: DirtyRaw,
  remote: DirtyRaw,
  resolved: DirtyRaw,
) => DirtyRaw;

export type SyncArgs = {
  database: Database;
  pullChanges: (arg1: SyncPullArgs) => Promise<SyncPullResult>;
  pushChanges: (arg1: SyncPushArgs) => Promise<void>;
  // version at which support for migration syncs was added - the version BEFORE first syncable migration
  migrationsEnabledAtVersion?: SchemaVersion;
  sendCreatedAsUpdated?: boolean;
  log?: SyncLog;
  // Advanced (unsafe) customization point. Useful when you have subtle invariants between multiple
  // columns and want to have them updated consistently, or to implement partial sync
  // It's called for every record being updated locally, so be sure that this function is FAST.
  // If you don't want to change default behavior for a given record, return `resolved` as is
  // Note that it's safe to mutate `resolved` object, so you can skip copying it for performance.
  conflictResolver?: SyncConflictResolver;
  // commits changes in multiple batches, and not one - temporary workaround for memory issue
  _unsafeBatchPerCollection?: boolean;
  useSequenceIds?: boolean;
};

// See Sync docs for usage details

export async function synchronize(
  {
    database,
    pullChanges,
    pushChanges,
    sendCreatedAsUpdated = false,
    useSequenceIds = false,
    migrationsEnabledAtVersion,
    log,
    conflictResolver,
    _unsafeBatchPerCollection,
  }: SyncArgs,
): Promise<void> {
  ensureActionsEnabled(database)
  const resetCount = database._resetCount
  log && (log.startedAt = new Date())

  // TODO: Wrap the three computionally intensive phases in `requestIdleCallback`

  // pull phase
  const lastPulledAt = await getLastPulledAt(database, useSequenceIds);
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
    if (!isSameDatabase(database, resetCount)) {return}

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
  if (!isSameDatabase(database, resetCount)) {return}

  if (!isChangeSetEmpty(localChanges.changes)) {
    await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })

    if (!isSameDatabase(database, resetCount)) {return}

    await markLocalChangesAsSynced(database, localChanges)
  }

  log && (log.finishedAt = new Date())
}

export async function hasUnsyncedChanges(
  {
    database,
  }: {
    database: Database;
  },
): Promise<boolean> {
  return hasUnsyncedChangesImpl(database)
}
