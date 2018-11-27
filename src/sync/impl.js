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
import { logError, invariant } from '../utils/common'
import type { Database, RecordId, Collection, Model } from '..'
import * as Q from '../QueryDescription'
import { columnName } from '../Schema'

import { prepareMarkAsSynced, prepareCreateFromRaw, prepareUpdateFromRaw } from './syncHelpers'
import type { SyncTableChangeSet, SyncDatabaseChangeSet, Timestamp } from './index'

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

const lastSyncedAtKey = '__watermelon_last_synced_at'

export async function getLastSyncedAt(database: Database): Promise<?Timestamp> {
  return parseInt(await database.adapter.getLocal(lastSyncedAtKey), 10) || null
}

export async function setLastSyncedAt(database: Database, timestamp: Timestamp): Promise<void> {
  await database.adapter.setLocal(lastSyncedAtKey, `${timestamp}`)
}

export function ensureActionsEnabled(database: Database): void {
  invariant(
    database._actionsEnabled,
    '[Sync] To use Sync, Actions must be enabled. Pass `{ actionsEnabled: true }` to Database constructor — see docs for more details',
  )
}

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
        logError(
          `[Sync] Server wants client to create record ${table}#${
            raw.id
          }, but it already exists locally. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will update existing record instead.`,
        )
        return prepareUpdateFromRaw(currentRecord, raw)
      } else if (contains(raw.id, locallyDeletedIds)) {
        logError(
          `[Sync] Server wants client to create record ${table}#${
            raw.id
          }, but it already exists locally and is marked as deleted. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will delete local record and recreate it instead.`,
        )
        // Note: we're not awaiting the async operation (but it will always complete before the batch)
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
      logError(
        `[Sync] Server wants client to update record ${table}#${
          raw.id
        }, but it doesn't exist locally. This could be a serious bug. Will create record instead.`,
      )

      return prepareCreateFromRaw(collection, raw)
    }, updated)

    await database.batch(...recordsToInsert, ...recordsToUpdate.filter(Boolean))
  })
}

export function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
): Promise<void> {
  ensureActionsEnabled(db)
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
  ensureActionsEnabled(db)
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
      if (!record) {
        logError(
          `[Sync] Looking for record ${
            raw.id
          } to mark it as synced, but I can't find it. Will ignore it (it should get synced next time). This is probably a Watermelon bug — please file an issue!`,
        )
        return records
      }

      // only include if it didn't change since fetch
      // TODO: get rid of `equals`
      return equals(record._raw, raw) ? records.concat(record) : records
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
  ensureActionsEnabled(db)
  return db.action(async () => {
    // update and destroy records concurrently
    await Promise.all([
      db.batch(...map(prepareMarkAsSynced, recordsToMarkAsSynced(syncedLocalChanges))),
      destroyDeletedRecords(db, syncedLocalChanges),
    ])
  })
}
