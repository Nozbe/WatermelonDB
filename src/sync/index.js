// @flow

import type { Database, RecordId, TableName } from '..'
import type { DirtyRaw } from '../RawRecord'

// TODO: Document me!

type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>

type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

async function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
): Promise<void> {
  // - insert new records
  //   - if already exists (error), update
  // - destroy permanently deleted records
  //   - if already deleted, ignore
  // - update records:
  //   - if locally synced, update
  //   - if locally updated (conflict):
  //     - take changes from server, apply local changes from _changed, update
  //   - if locally deleted:
  //     - ignore (will push deletion later)
  //   - if not found, insert
}

async function fetchLocalChanges(db: Database): Promise<SyncDatabaseChangeSet> {
  // - fetch all locally changed records (created, updated) - for all collections
  // - get all locally deleted ids - for all collections
  return {}
}

async function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncDatabaseChangeSet,
): Promise<void> {
  // - destroy permanently deleted records
  // - mark `created` and `updated` records as `synced` + reset _changed
}
