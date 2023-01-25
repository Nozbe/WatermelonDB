// @flow

import {
  // $FlowFixMe
  values,
  identity,
  unnest,
  allPromises,
  mapObj,
} from '../../utils/fp'
import allPromisesObj from '../../utils/fp/allPromisesObj'
import type { Database, Collection, Model } from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type { SyncTableChangeSet, SyncLocalChanges } from '../index'

// NOTE: Two separate queries are faster than notEq(synced) on LokiJS
const createdQuery = Q.where(columnName('_status'), 'created')
const updatedQuery = Q.where(columnName('_status'), 'updated')

async function fetchLocalChangesForCollection<T: Model>(
  collection: Collection<T>,
): Promise<[SyncTableChangeSet, T[]]> {
  const [createdRecords, updatedRecords, deletedRecords] = await Promise.all([
    collection.query(createdQuery).fetch(),
    collection.query(updatedQuery).fetch(),
    collection.database.adapter.getDeletedRecords(collection.table),
  ])
  const changeSet = {
    created: [],
    updated: [],
    deleted: deletedRecords,
  }
  // TODO: It would be best to omit _status, _changed fields, since they're not necessary for the server
  // but this complicates markLocalChangesAsDone, since we don't have the exact copy to compare if record changed
  // TODO: It would probably also be good to only send to server locally changed fields, not full records
  // perf-critical - using mutation
  createdRecords.forEach((record) => {
    // $FlowFixMe
    changeSet.created.push(Object.assign({}, record._raw))
  })
  updatedRecords.forEach((record) => {
    // $FlowFixMe
    changeSet.updated.push(Object.assign({}, record._raw))
  })
  const changedRecords = createdRecords.concat(updatedRecords)

  return [changeSet, changedRecords]
}

export default function fetchLocalChanges(db: Database): Promise<SyncLocalChanges> {
  return db.read(async () => {
    const changes = await allPromisesObj(mapObj(fetchLocalChangesForCollection, db.collections.map))
    // TODO: deep-freeze changes object (in dev mode only) to detect mutations (user bug)
    return {
      // $FlowFixMe
      changes: mapObj(([changeSet]) => changeSet)(changes),
      affectedRecords: unnest(values(changes).map(([, records]) => records)),
    }
  }, 'sync-fetchLocalChanges')
}

export function hasUnsyncedChanges(db: Database): Promise<boolean> {
  // action is necessary to ensure other code doesn't make changes under our nose
  return db.read(async () => {
    // $FlowFixMe
    const collections = values(db.collections.map)
    const hasUnsynced = async (collection: Collection<any>) => {
      const created = await collection.query(createdQuery).fetchCount()
      const updated = await collection.query(updatedQuery).fetchCount()
      const deleted = await db.adapter.getDeletedRecords(collection.table)
      return created + updated + deleted.length > 0
    }
    // $FlowFixMe
    const unsyncedFlags = await allPromises(hasUnsynced, collections)
    return unsyncedFlags.some(identity)
  }, 'sync-hasUnsyncedChanges')
}
