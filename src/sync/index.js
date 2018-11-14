// @flow

import { mapAsync, promiseAllObject, map, reduce, values, pipe } from 'rambdax'
import { unnest } from '../utils/fp'
// import { logError } from '../utils/common'
import type { Database, RecordId, TableName, Collection, Model } from '..'
import { type DirtyRaw } from '../RawRecord'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import { markAsSynced } from './syncHelpers'

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

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

export function markLocalChangesAsSyncedForCollection<T: Model>(
  collection: Collection<T>,
  syncedLocalChanges: SyncTableChangeSet,
  cachedRecords: Model[],
): Promise<void> {
  const { database } = collection
  return database.action(async () => {
    const { created, updated, deleted } = syncedLocalChanges

    await database.adapter.destroyDeletedRecords(collection.table, deleted)
    const syncedRecords = recordsForRaws([...created, ...updated], cachedRecords)
    await database.batch(...syncedRecords.map(record => record.prepareUpdate(markAsSynced)))
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
