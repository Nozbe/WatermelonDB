// @flow

import { mapAsync, contains } from 'rambdax'
import { allPromises } from '../utils/fp'
// import { logError } from '../utils/common'
import type { Database, RecordId, TableName, Collection, Model } from '..'
import { type DirtyRaw, sanitizedRaw } from '../RawRecord'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import {
  resolveConflict,
  replaceRaw,
  prepareCreateFromRaw,
  prepareUpdateFromRaw,
} from './syncHelpers'

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
  // TODO:
  //
  // - What about the last synced at timestamp? How does it work?
  // - What about the last_modified fields on every single item?
  // - Can I end action and begin new one between pull and push stage?
  // - How can I safely avoid a blocking action while pushing changes?
  //   - Option 1: fetchLocalChanges() should return not just extracted raws, but also references to the Model objects. After server ACK, those Models should be passed to markLocalChangseAsSynced. Other changes that happen in the meantime will be ignored. And for changes in _those_ records, compare a COPY of extracted raw to the current one. If different, don't mark as synced.
  //   - Option 2: If cloning raw object is too expensive, you could mutate a Model to mark a flag `isBeingSynced`. If true, further changes to the object would make a raw copy. (ugh)
  //   - Maybe cloning raw object is necessary anyway? Write tests!
  // - What are different sync failure modes and how can they be dealt with safely?:
  //   - failure to fetch changes
  //   - failure to apply fetched changes
  //   - only pull but not push
  //   - failure to push changes
  //   - failure to update after push
  //   - bad timestamps?
  // - batching (i.e. splitting into smaller chunks) — necessary? how much can wmelon take?
  // - error handling — preventing data corruption in case sync fails
  // - error logging - logging invalid scenarios (suggesting a bug) — e.g.
  // - sync adapters - should this be THE implemention? A collection of helpers for others to use to build their own sync engines/adapters? Should this be a class, similar to DatabaseAdapter?
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
      const currentRecord = records.find(record => record.id === raw.id)
      if (currentRecord) {
        // TODO: log error -- record already exists, update instead
        return prepareUpdateFromRaw(currentRecord, raw)
      }

      return prepareCreateFromRaw(collection, raw)
    })

    const recordsToUpdate = updated
      .map(raw => {
        const currentRecord = records.find(record => record.id === raw.id)

        if (currentRecord) {
          return prepareUpdateFromRaw(currentRecord, raw)
        } else if (locallyDeletedIds.some(id => id === raw.id)) {
          // Nothing to do, record was locally deleted, deletion will be pushed later
        } else {
          // Record doesn't exist (but should) — just create it
          return prepareCreateFromRaw(collection, raw)
        }
      })
      .filter(Boolean)

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

export async function fetchLocalChangesForCollection<T: Model>(
  collection: Collection<T>,
): Promise<SyncTableChangeSet> {
  const changedRecords = await collection
    .query(Q.where(columnName('_status'), Q.notEq('synced')))
    .fetch()
  const created = changedRecords
    .filter(record => record.syncStatus === 'created')
    .map(record => record._raw)
  const updated = changedRecords
    .filter(record => record.syncStatus === 'updated')
    .map(record => record._raw)
  const deleted = await collection.database.adapter.getDeletedRecords(collection.table)
  return { created, updated, deleted }
}

export function fetchLocalChanges(db: Database): Promise<SyncDatabaseChangeSet> {
  // - fetch all locally changed records (created, updated) - for all collections
  // - get all locally deleted ids - for all collections

  // TODO: Use parallel mapping
  return mapAsync(fetchLocalChangesForCollection, db.collections.map)
}

export function markLocalChangesAsSyncedForCollection<T: Model>(
  collection: Collection<T>,
  syncedLocalChanges: SyncTableChangeSet,
): Promise<void> {
  const { database } = collection
  return database.action(async () => {
    // - destroy deleted records permanently
    // - mark `created` and `updated` records as `synced` + reset _changed

    const { created, updated, deleted } = syncedLocalChanges

    database.adapter.destroyDeletedRecords(collection.table, deleted)
    database.batch(
      ...[...created, ...updated].map(record =>
        record.prepareUpdate(() => {
          record._raw._changed = ''
          record._raw._status = 'synced'
        }),
      ),
    )
  })
}

export function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncDatabaseChangeSet,
): Promise<void> {
  return db.action(async action => {
    // TODO: Does the order of collections matter? Should they be done one by one? Or all at once?
    await mapAsync(
      ([changes, tableName]) =>
        action.subAction(() =>
          markLocalChangesAsSyncedForCollection(db.collections.get(tableName), changes),
        ),
      syncedLocalChanges,
    )
  })
}
