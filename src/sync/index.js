// @flow

import { mapAsync, contains } from 'rambdax'
import { allPromises } from '../utils/fp'
import type { Database, RecordId, TableName, Collection, Model } from '..'
import { type DirtyRaw, sanitizedRaw } from '../RawRecord'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import { resolveConflict, replaceRaw } from './syncHelpers'

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
  // - error handling — preventing data corruption in case sync fails
}

export function applyRemoteChangesToCollection<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
): Promise<void> {
  const { database } = collection
  return database.action(async () => {
    // - insert new records
    //   - if already exists (error), update
    // - destroy deleted records permanently
    //   - if already deleted, ignore
    //   - TODO: Should we delete with descendants? Or just let sync point to record to delete?
    // - update records:
    //   - if locally synced, update
    //   - if locally updated (conflict):
    //     - take changes from server, apply local changes from _changed, update
    //   - if locally deleted:
    //     - ignore (will push deletion later)
    //   - if not found, insert
    // TODO: Does the order between insert/update/destroy matter?

    const { created, updated, deleted: deletedIds } = changes

    const ids: RecordId[] = [...created, ...updated].map(({ id }) => id).concat(deletedIds)
    const records = await collection.query(Q.where(columnName('id'), Q.oneOf(ids))).fetch()
    const locallyDeletedIds = await database.adapter.getDeletedRecords(collection.table)

    // Destroy records (if already marked as deleted, just destroy permanently)
    const recordsToDestroy = records.filter(record => contains(record.id, deletedIds))
    const deletedRecordsToDestroy = locallyDeletedIds.filter(id => contains(id, deletedIds))

    await allPromises(record => record.destroyPermanently(), recordsToDestroy)
    await database.adapter.destroyDeletedRecords(collection.table, deletedRecordsToDestroy)

    // Insert and update records
    const recordsToInsert = created.map(raw => {
      if (records.find(record => record.id === raw.id)) {
        // TODO: Error, record already exists, update instead
      } else {
        return collection.prepareCreate(record => {
          replaceRaw(record, raw)
        })
      }
    })

    const recordsToUpdate = updated.map(raw => {
      const currentRecord = records.find(record => record.id === raw.id)

      if (currentRecord) {
        if (currentRecord.syncStatus === 'synced') {
          // just replace
          return currentRecord.prepareUpdate(() => {
            replaceRaw(currentRecord, raw)
          })
        } else if (currentRecord.syncStatus === 'updated') {
          // conflict
          return currentRecord.prepareUpdate(() => {
            replaceRaw(currentRecord, resolveConflict(currentRecord._raw, raw))
          })
        }
        // TODO: ????
      } else if (locallyDeletedIds.some(id => id === raw.id)) {
        // Nothing to do, record was locally deleted, deletion will be pushed later
      } else {
        return collection.prepareCreate(record => {
          replaceRaw(record, raw)
        })
      }
    })

    await database.batch(...recordsToInsert, ...recordsToUpdate)
  })
}

export function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
): Promise<void> {
  return db.action(async action => {
    // TODO: Does the order of collections matter? Should they be done one by one? Or all at once?
    await mapAsync(
      ([changes, tableName]) =>
        action.subAction(() =>
          applyRemoteChangesToCollection(db.collections.get(tableName), changes),
        ),
      remoteChanges,
    )
  })
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
  // - destroy deleted records permanently
  // - mark `created` and `updated` records as `synced` + reset _changed
}
