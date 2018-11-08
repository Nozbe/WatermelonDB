// @flow

import type { Database, RecordId, TableName } from '..'
import type { DirtyRaw } from '../RawRecord'

// TODO: Document me!

type Timestamp = number
export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>
export type SyncPullResult = $Exact<{ changes: SyncDatabaseChangeSet, timestamp: Timestamp }>
export type SyncParams = $Exact<{
  database: Database,
  pullChanges: () => Promise<SyncPullResult>,
  pushChanges: SyncDatabaseChangeSet => Promise<void>,
}>

export async function synchronize({
  database,
  pullChanges,
  pushChanges,
}: SyncParams): Promise<void> {
  // **Sync procedure:**
  //
  // - pull changes
  //   - get `last synced at` timestamp
  //   - fetch remote changes since timestamp
  //   - BEGIN ACTION
  //     - applyRemoteChanges()
  //   - END ACTION (?)
  // - push changes
  //   - BEGIN ACTION
  //   - fetchLocalChanges()
  //   - push local changes to server - wait for ACK
  //   - markLocalChangesAsSynced()
  //   - END ACTION
  //
  // Open questions:
  //
  // - What about the last synced at timestamp? How does it work?
  // - What about the last_modified fields on every single item?
  // - Can I end action and begin new one between pull and push stage?
  // - How can I safely avoid a blocking action while pushing changes?
  // - What are different sync failure modes and how can they be dealt with safely?:
  //   - failure to fetch changes
  //   - failure to apply fetched changes
  //   - only pull but not push
  //   - failure to push changes
  //   - failure to update after push
  //   - bad timestamps?
  // - batching (i.e. splitting into smaller chunks) — necessary? how much can wmelon take?
}

export async function applyRemoteChanges(
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

export async function fetchLocalChanges(db: Database): Promise<SyncDatabaseChangeSet> {
  // - fetch all locally changed records (created, updated) - for all collections
  // - get all locally deleted ids - for all collections
  return {}
}

export async function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncDatabaseChangeSet,
): Promise<void> {
  // - destroy permanently deleted records
  // - mark `created` and `updated` records as `synced` + reset _changed
}
