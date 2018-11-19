// @flow

import {
  // $FlowFixMe
  mapAsync,
  // $FlowFixMe
  promiseAllObject,
  map,
  reduce,
  contains,
  values,
  pipe,
  filter,
  find,
} from 'rambdax'
import { allPromises, unnest } from '../utils/fp'
// import { logError } from '../utils/common'
import type { Database, RecordId, TableName, Collection, Model } from '..'
import { type DirtyRaw } from '../RawRecord'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import { markAsSynced, prepareCreateFromRaw, prepareUpdateFromRaw } from './syncHelpers'

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

// *** Applying remote changes ***

const getRawId = ({ id }) => id
const getIds = map(getRawId)
const findRecord = <T: Model>(id: RecordId, list: T[]) => find(record => record.id === id, list)

function applyRemoteChangesToCollection<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
): Promise<void> {
  const { database } = collection
  return database.action(async () => {
    const { created, updated, deleted: deletedIds } = changes

    const ids: RecordId[] = [...getIds(created), ...getIds(updated), ...deletedIds]
    const records = await collection.query(Q.where(columnName('id'), Q.oneOf(ids))).fetch()
    const locallyDeletedIds = await database.adapter.getDeletedRecords(collection.table)

    // Destroy records (if already marked as deleted, just destroy permanently)
    const recordsToDestroy = filter(record => contains(record.id, deletedIds), records)
    const deletedRecordsToDestroy = filter(id => contains(id, deletedIds), locallyDeletedIds)

    await allPromises(record => record.destroyPermanently(), recordsToDestroy)
    await database.adapter.destroyDeletedRecords(collection.table, deletedRecordsToDestroy)

    // Insert and update records
    const recordsToInsert = map(raw => {
      const currentRecord = findRecord(raw.id, records)
      if (currentRecord) {
        // TODO: log error -- record already exists, update instead
        return prepareUpdateFromRaw(currentRecord, raw)
      } else if (contains(raw.id, locallyDeletedIds)) {
        // FIXME: this will fail
        // database.adapter.destroyDeletedRecords(collection.table, raw.id)
        return prepareCreateFromRaw(collection, raw)
      }

      return prepareCreateFromRaw(collection, raw)
    }, created)

    const recordsToUpdate = map(raw => {
      const currentRecord = findRecord(raw.id, records)

      if (currentRecord) {
        return prepareUpdateFromRaw(currentRecord, raw)
      } else if (contains(raw.id, locallyDeletedIds)) {
        // Nothing to do, record was locally deleted, deletion will be pushed later
        return null
      }

      // Record doesn't exist (but should) — just create it
      return prepareCreateFromRaw(collection, raw)
    }, updated).filter(Boolean)

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
      (changes, tableName) =>
        action.subAction(() =>
          applyRemoteChangesToCollection(db.collections.get(tableName), changes),
        ),
      remoteChanges,
    )
  })
}

// *** Fetching local changes ***

const notSyncedQuery = Q.where(columnName('_status'), Q.notEq('synced'))
const rawsForStatus = (status, records) =>
  reduce(
    (raws, record) => (record._raw._status === status ? raws.concat({ ...record._raw }) : raws),
    [],
    records,
  )

async function fetchLocalChangesForCollection<T: Model>(
  collection: Collection<T>,
): Promise<[SyncTableChangeSet, T[]]> {
  const changedRecords = await collection.query(notSyncedQuery).fetch()
  const changeSet = {
    created: rawsForStatus('created', changedRecords),
    updated: rawsForStatus('updated', changedRecords),
    deleted: await collection.database.adapter.getDeletedRecords(collection.table),
  }
  return [changeSet, changedRecords]
}

const extractChanges = map(([changeSet]) => changeSet)
const extractAllAffectedRecords = pipe(
  values,
  map(([, records]) => records),
  unnest,
)

export function fetchLocalChanges(db: Database): Promise<SyncLocalChanges> {
  return db.action(async () => {
    const changes = await promiseAllObject(
      map(
        fetchLocalChangesForCollection,
        // $FlowFixMe
        db.collections.map,
      ),
    )
    return {
      // $FlowFixMe
      changes: extractChanges(changes),
      affectedRecords: extractAllAffectedRecords(changes),
    }
  })
}

// *** Mark local changes as synced ***

const recordsForRaws = (raws, recordCache) =>
  reduce(
    (records, raw) => {
      const record = recordCache.find(model => model.id === raw.id)
      if (record) {
        return records.concat(record)
      }

      // TODO: Log error
      return records
    },
    [],
    raws,
  )

function markLocalChangesAsSyncedForCollection<T: Model>(
  collection: Collection<T>,
  syncedLocalChanges: SyncTableChangeSet,
  cachedRecords: Model[],
): Promise<void> {
  const { database } = collection
  return database.action(async () => {
    const { created, updated, deleted } = syncedLocalChanges

    await database.adapter.destroyDeletedRecords(collection.table, deleted)
    const syncedRecords = recordsForRaws([...created, ...updated], cachedRecords)
    await database.batch(...map(record => record.prepareUpdate(markAsSynced), syncedRecords))
  })
}

export function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
): Promise<void> {
  return db.action(async action => {
    // TODO: Does the order of collections matter? Should they be done one by one? Or all at once?
    const { changes: localChanges, affectedRecords } = syncedLocalChanges
    await mapAsync(
      (changes, tableName) =>
        action.subAction(() =>
          markLocalChangesAsSyncedForCollection(
            db.collections.get(tableName),
            changes,
            affectedRecords,
          ),
        ),
      localChanges,
    )
  })
}
