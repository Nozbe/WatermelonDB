// @flow

import {
  // $FlowFixMe
  promiseAllObject,
  map,
  reduce,
  values,
  pipe,
  any,
  identity,
} from 'rambdax'
import { unnest, allPromises } from '../../utils/fp'
import { invariant } from '../../utils/common'
import type { Database, Collection, Model } from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type { SyncTableChangeSet, SyncDatabaseChangeSet } from '../index'
import { ensureActionsEnabled } from './helpers'

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

const notSyncedQuery = Q.where(columnName('_status'), Q.notEq('synced'))

async function fetchLocalChangesForCollection<T: Model>(
  collection: Collection<T>,
): Promise<[SyncTableChangeSet, T[]]> {
  const [changedRecords, deletedRecords] = await Promise.all([
    collection.query(notSyncedQuery).fetch(),
    collection.database.adapter.getDeletedRecords(collection.table),
  ])
  const changeSet = {
    created: [],
    updated: [],
    deleted: deletedRecords,
  }
  // perf-critical - using mutation
  changedRecords.forEach(record => {
    const status = record._raw._status
    invariant(status === 'created' || status === 'updated', `Invalid changed record status`)
    // TODO: It would be best to omit _status, _changed fields, since they're not necessary for the server
    // but this complicates markLocalChangesAsDone, since we don't have the exact copy to compare if record changed
    // TODO: It would probably also be good to only send to server locally changed fields, not full records
    changeSet[status].push(Object.assign({}, record._raw))
  })

  return [changeSet, changedRecords]
}

const extractChanges = map(([changeSet]) => changeSet)
const extractAllAffectedRecords = pipe(
  values,
  map(([, records]) => records),
  unnest,
)

export default function fetchLocalChanges(db: Database): Promise<SyncLocalChanges> {
  ensureActionsEnabled(db)
  return db.action(async () => {
    const changes = await promiseAllObject(
      map(
        fetchLocalChangesForCollection,
        // $FlowFixMe
        db.collections.map,
      ),
    )
    // TODO: deep-freeze changes object (in dev mode only) to detect mutations (user bug)
    return {
      // $FlowFixMe
      changes: extractChanges(changes),
      affectedRecords: extractAllAffectedRecords(changes),
    }
  }, 'sync-fetchLocalChanges')
}

export function hasUnsyncedChanges(db: Database): Promise<boolean> {
  ensureActionsEnabled(db)
  // action is necessary to ensure other code doesn't make changes under our nose
  return db.action(async () => {
    const collections = values(db.collections.map)
    const hasUnsynced = async collection => {
      const changes = await collection.query(notSyncedQuery).fetchCount()
      const deleted = await db.adapter.getDeletedRecords(collection.table)
      return changes + deleted.length > 0
    }
    const unsyncedFlags = await allPromises(hasUnsynced, collections)
    return any(identity, unsyncedFlags)
  }, 'sync-hasUnsyncedChanges')
}
