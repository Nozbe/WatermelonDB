// @flow

import {
  // $FlowFixMe
  promiseAllObject,
  map,
  reduce,
  contains,
  values,
  pipe,
  filter,
  find,
  equals,
} from 'rambdax'
import { allPromises, unnest } from '../utils/fp'
// import { logError } from '../utils/common'
import type { Database, RecordId, TableName, Collection, Model } from '..'
import { type DirtyRaw } from '../RawRecord'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import { prepareMarkAsSynced, prepareCreateFromRaw, prepareUpdateFromRaw } from './syncHelpers'

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

// *** Applying remote changes ***

const getIds = map(({ id }) => id)
const idsForChanges = ({ created, updated, deleted }: SyncTableChangeSet): RecordId[] => [
  ...getIds(created),
  ...getIds(updated),
  ...deleted,
]
const queryForChanges = changes => Q.where(columnName('id'), Q.oneOf(idsForChanges(changes)))

const findRecord = <T: Model>(id: RecordId, list: T[]) => find(record => record.id === id, list)

function applyRemoteChangesToCollection<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
): Promise<void> {
  const { database, table } = collection
  return database.action(async () => {
    const { created, updated, deleted: deletedIds } = changes

    const records = await collection.query(queryForChanges(changes)).fetch()
    const locallyDeletedIds = await database.adapter.getDeletedRecords(table)

    // Destroy records (if already marked as deleted, just destroy permanently)
    const recordsToDestroy = filter(record => contains(record.id, deletedIds), records)
    const deletedRecordsToDestroy = filter(id => contains(id, deletedIds), locallyDeletedIds)

    await allPromises(record => record.destroyPermanently(), recordsToDestroy)

    if (deletedRecordsToDestroy.length) {
      await database.adapter.destroyDeletedRecords(table, deletedRecordsToDestroy)
    }

    // Insert and update records
    const recordsToInsert = map(raw => {
      const currentRecord = findRecord(raw.id, records)
      if (currentRecord) {
        // TODO: log error -- record already exists, update instead
        return prepareUpdateFromRaw(currentRecord, raw)
      } else if (contains(raw.id, locallyDeletedIds)) {
        // This record is marked as deleted, but shouldn't exist. We'll destroy it
        // and then recreate it. Note that we're not awaiting the async operation
        // (but it will always complete before the batch)
        database.adapter.destroyDeletedRecords(table, [raw.id])
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
    await promiseAllObject(
      map(
        (changes, tableName) =>
          action.subAction(() =>
            applyRemoteChangesToCollection(db.collections.get(tableName), changes),
          ),
        // $FlowFixMe
        remoteChanges,
      ),
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

const unchangedRecordsForRaws = (raws, recordCache) =>
  reduce(
    (records, raw) => {
      const record = recordCache.find(model => model.id === raw.id)
      if (record) {
        // only include if it didn't change since fetch
        // TODO: get rid of `equals`
        return equals(record._raw, raw) ? records.concat(record) : records
      }

      // TODO: Log error
      return records
    },
    [],
    raws,
  )

const recordsToMarkAsSynced = ({ changes, affectedRecords }: SyncLocalChanges): Model[] =>
  pipe(
    values,
    map(({ created, updated }) =>
      unchangedRecordsForRaws([...created, ...updated], affectedRecords),
    ),
    unnest,
  )(changes)

const destroyDeletedRecords = (db: Database, { changes }: SyncLocalChanges): Promise<*> =>
  promiseAllObject(
    map(
      ({ deleted }, tableName) => db.adapter.destroyDeletedRecords(tableName, deleted),
      // $FlowFixMe
      changes,
    ),
  )

export function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
): Promise<void> {
  return db.action(async () => {
    // update and destroy records concurrently
    await Promise.all([
      db.batch(...map(prepareMarkAsSynced, recordsToMarkAsSynced(syncedLocalChanges))),
      destroyDeletedRecords(db, syncedLocalChanges),
    ])
  })
}
