// @flow

import {
  // $FlowFixMe
  promiseAllObject,
  map,
  values,
  filter,
  piped,
  splitEvery,
} from 'rambdax'
import { unnest } from '../../utils/fp'
import { logError, invariant, logger } from '../../utils/common'
import type { Database, RecordId, Collection, Model, TableName, DirtyRaw } from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type { SyncTableChangeSet, SyncDatabaseChangeSet, SyncLog } from '../index'
import { prepareCreateFromRaw, prepareUpdateFromRaw, ensureActionsEnabled } from './helpers'

const idsForChanges = ({ created, updated, deleted }: SyncTableChangeSet): RecordId[] => {
  const ids = []
  created.forEach(record => {
    ids.push(record.id)
  })
  updated.forEach(record => {
    ids.push(record.id)
  })
  return ids.concat(deleted)
}

const fetchRecordsForChanges = <T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
): Promise<T[]> => {
  const ids = idsForChanges(changes)

  if (ids.length) {
    return collection.query(Q.where(columnName('id'), Q.oneOf(ids))).fetch()
  }

  return Promise.resolve([])
}

const findRecord = <T: Model>(id: RecordId, list: T[]): T | null => {
  // perf-critical
  for (let i = 0, len = list.length; i < len; i += 1) {
    if (list[i]._raw.id === id) {
      return list[i]
    }
  }
  return null
}

type RecordsToApplyRemoteChangesTo<T: Model> = {
  ...SyncTableChangeSet,
  records: T[],
  recordsToDestroy: T[],
  locallyDeletedIds: RecordId[],
  deletedRecordsToDestroy: RecordId[],
}
async function recordsToApplyRemoteChangesTo<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
): Promise<RecordsToApplyRemoteChangesTo<T>> {
  const { database, table } = collection
  const { deleted: deletedIds } = changes

  const [records, locallyDeletedIds] = await Promise.all([
    fetchRecordsForChanges(collection, changes),
    database.adapter.getDeletedRecords(table),
  ])

  return {
    ...changes,
    records,
    locallyDeletedIds,
    recordsToDestroy: filter(record => deletedIds.includes(record.id), records),
    deletedRecordsToDestroy: filter(id => deletedIds.includes(id), locallyDeletedIds),
  }
}

function validateRemoteRaw(raw: DirtyRaw): void {
  // TODO: I think other code is actually resilient enough to handle illegal _status and _changed
  // would be best to change that part to a warning - but tests are needed
  invariant(
    raw && typeof raw === 'object' && 'id' in raw && !('_status' in raw || '_changed' in raw),
    `[Sync] Invalid raw record supplied to Sync. Records must be objects, must have an 'id' field, and must NOT have a '_status' or '_changed' fields`,
  )
}

function prepareApplyRemoteChangesToCollection<T: Model>(
  collection: Collection<T>,
  recordsToApply: RecordsToApplyRemoteChangesTo<T>,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
): T[] {
  const { database, table } = collection
  const { created, updated, recordsToDestroy: deleted, records, locallyDeletedIds } = recordsToApply

  // if `sendCreatedAsUpdated`, server should send all non-deleted records as `updated`
  // log error if it doesn't — but disable standard created vs updated errors
  if (sendCreatedAsUpdated && created.length) {
    logError(
      `[Sync] 'sendCreatedAsUpdated' option is enabled, and yet server sends some records as 'created'`,
    )
  }

  const recordsToBatch: T[] = [] // mutating - perf critical

  // Insert and update records
  created.forEach(raw => {
    validateRemoteRaw(raw)
    const currentRecord = findRecord(raw.id, records)
    if (currentRecord) {
      logError(
        `[Sync] Server wants client to create record ${table}#${raw.id}, but it already exists locally. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will update existing record instead.`,
      )
      recordsToBatch.push(prepareUpdateFromRaw(currentRecord, raw, log))
    } else if (locallyDeletedIds.includes(raw.id)) {
      logError(
        `[Sync] Server wants client to create record ${table}#${raw.id}, but it already exists locally and is marked as deleted. This may suggest last sync partially executed, and then failed; or it could be a serious bug. Will delete local record and recreate it instead.`,
      )
      // Note: we're not awaiting the async operation (but it will always complete before the batch)
      database.adapter.destroyDeletedRecords(table, [raw.id])
      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    } else {
      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    }
  })

  updated.forEach(raw => {
    validateRemoteRaw(raw)
    const currentRecord = findRecord(raw.id, records)

    if (currentRecord) {
      recordsToBatch.push(prepareUpdateFromRaw(currentRecord, raw, log))
    } else if (locallyDeletedIds.includes(raw.id)) {
      // Nothing to do, record was locally deleted, deletion will be pushed later
    } else {
      // Record doesn't exist (but should) — just create it
      !sendCreatedAsUpdated &&
        logError(
          `[Sync] Server wants client to update record ${table}#${raw.id}, but it doesn't exist locally. This could be a serious bug. Will create record instead.`,
        )

      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    }
  })

  deleted.forEach(record => {
    recordsToBatch.push(record.prepareDestroyPermanently())
  })

  return recordsToBatch
}

type AllRecordsToApply = { [TableName<any>]: RecordsToApplyRemoteChangesTo<Model> }

const getAllRecordsToApply = (
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
): AllRecordsToApply =>
  piped(
    remoteChanges,
    // $FlowFixMe
    filter((_changes, tableName: TableName<any>) => {
      const collection = db.collections.get((tableName: any))

      if (!collection) {
        logger.warn(
          `You are trying to sync a collection named ${tableName}, but it does not exist. Will skip it (for forward-compatibility). If this is unexpected, perhaps you forgot to add it to your Database constructor's modelClasses property?`,
        )
      }

      return !!collection
    }),
    map((changes, tableName: TableName<any>) => {
      return recordsToApplyRemoteChangesTo(db.collections.get((tableName: any)), changes)
    }),
    promiseAllObject,
  )

const destroyAllDeletedRecords = (db: Database, recordsToApply: AllRecordsToApply): Promise<*> =>
  piped(
    recordsToApply,
    map(
      ({ deletedRecordsToDestroy }, tableName: TableName<any>) =>
        deletedRecordsToDestroy.length &&
        db.adapter.destroyDeletedRecords((tableName: any), deletedRecordsToDestroy),
    ),
    promiseAllObject,
  )

const prepareApplyAllRemoteChanges = (
  db: Database,
  recordsToApply: AllRecordsToApply,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
): Model[] =>
  piped(
    recordsToApply,
    map((records, tableName: TableName<any>) =>
      prepareApplyRemoteChangesToCollection(
        db.collections.get((tableName: any)),
        records,
        sendCreatedAsUpdated,
        log,
      ),
    ),
    values,
    unnest,
  )

// See _unsafeBatchPerCollection - temporary fix
const unsafeBatchesWithRecordsToApply = (
  db: Database,
  recordsToApply: AllRecordsToApply,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
): Promise<void>[] =>
  piped(
    recordsToApply,
    map((records, tableName: TableName<any>) =>
      piped(
        prepareApplyRemoteChangesToCollection(
          db.collections.get((tableName: any)),
          records,
          sendCreatedAsUpdated,
          log,
        ),
        splitEvery(5000),
        map(recordBatch => db.batch(...recordBatch)),
      ),
    ),
    values,
    unnest,
  )

export default function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
  _unsafeBatchPerCollection?: boolean,
): Promise<void> {
  ensureActionsEnabled(db)
  return db.action(async () => {
    const recordsToApply = await getAllRecordsToApply(db, remoteChanges)

    // Perform steps concurrently
    await Promise.all([
      destroyAllDeletedRecords(db, recordsToApply),
      ...(_unsafeBatchPerCollection
        ? unsafeBatchesWithRecordsToApply(db, recordsToApply, sendCreatedAsUpdated, log)
        : [
            db.batchArray(
              prepareApplyAllRemoteChanges(db, recordsToApply, sendCreatedAsUpdated, log),
            ),
          ]),
    ])
  }, 'sync-applyRemoteChanges')
}
