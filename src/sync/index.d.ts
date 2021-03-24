declare module '@nozbe/watermelondb/sync' {
  import { DirtyRaw, RecordId, TableName, Model, Database } from '@nozbe/watermelondb';
  import { Migration } from '@nozbe/watermelondb/Schema/migrations';
  
  export type Timestamp = number

  export type SyncTableChangeSet = {
    created: DirtyRaw[],
    updated: DirtyRaw[],
    deleted: RecordId[],
  }
  export type SyncDatabaseChangeSet = { [table: string]: SyncTableChangeSet }

  export type SyncLocalChanges = { changes: SyncDatabaseChangeSet, affectedRecords: Model[] }

  export type SyncPullArgs = { lastPulledAt: Timestamp | null, schemaVersion?: number, migration?: Migration | null }
  export type SyncPullResult = { changes: SyncDatabaseChangeSet, timestamp: Timestamp }

  export type SyncPushArgs = { changes: SyncDatabaseChangeSet, lastPulledAt: Timestamp }

  type SyncConflict = { local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw }
  export type SyncLog = {
    startedAt?: Date,
    lastPulledAt?: number,
    newLastPulledAt?: number,
    resolvedConflicts?: SyncConflict[],
    finishedAt?: Date,
  }

  export type SyncArgs = {
    database: Database,
    pullChanges: (args: SyncPullArgs) => Promise<SyncPullResult>,
    pushChanges: (args: SyncPushArgs) => Promise<void>,
    sendCreatedAsUpdated?: boolean,
    log?: SyncLog,
    _unsafeBatchPerCollection?: boolean, // commits changes in multiple batches, and not one - temporary workaround for memory issue
    migrationsEnabledAtVersion?: number
  }

  export function synchronize({
    database,
    pullChanges,
    pushChanges,
    sendCreatedAsUpdated,
    log,
    _unsafeBatchPerCollection,
  }: SyncArgs): Promise<void>
}
