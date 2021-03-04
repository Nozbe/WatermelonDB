// @flow

import {
  // $FlowFixMe
  promiseAllObject,
  map,
  values,
  pipe,
  unnest,
} from '../../utils/fp'
import splitEvery from '../../utils/fp/splitEvery'
import { logError, invariant, logger } from '../../utils/common'
import type { Database, RecordId, Collection, Model, TableName, DirtyRaw } from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type {
  SyncTableChangeSet,
  SyncDatabaseChangeSet,
  SyncLog,
  SyncConflictResolver,
} from '../index'
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
    recordsToDestroy: records.filter(record => deletedIds.includes(record.id)),
    deletedRecordsToDestroy: locallyDeletedIds.filter(id => deletedIds.includes(id)),
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
  conflictResolver?: SyncConflictResolver,
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
      recordsToBatch.push(prepareUpdateFromRaw(currentRecord, raw, log, conflictResolver))
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
      recordsToBatch.push(prepareUpdateFromRaw(currentRecord, raw, log, conflictResolver))
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
    // $FlowFixMe
    recordsToBatch.push(record.prepareDestroyPermanently())
  })

  return recordsToBatch
}

type AllRecordsToApply = { [TableName<any>]: RecordsToApplyRemoteChangesTo<Model> }

const getAllRecordsToApply = (
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
): AllRecordsToApply =>
  promiseAllObject(
    // $FlowFixMe
    remoteChanges
    .filter((_changes, tableName: TableName<any>) => {
      const collection = db.get((tableName: any))

      if (!collection) {
        logger.warn(
          `You are trying to sync a collection named ${tableName}, but it does not exist. Will skip it (for forward-compatibility). If this is unexpected, perhaps you forgot to add it to your Database constructor's modelClasses property?`,
        )
      }

      return !!collection
    })
    .map((changes, tableName: TableName<any>) => {
      return recordsToApplyRemoteChangesTo(db.get((tableName: any)), changes)
    }),
  )

const destroyAllDeletedRecords = (db: Database, recordsToApply: AllRecordsToApply): Promise<*> =>
  pipe(
    map(
      ({ deletedRecordsToDestroy }, tableName: TableName<any>) =>
        deletedRecordsToDestroy.length &&
        db.adapter.destroyDeletedRecords((tableName: any), deletedRecordsToDestroy),
    ),
    promiseAllObject,
  )(recordsToApply)

const prepareApplyAllRemoteChanges = (
  db: Database,
  recordsToApply: AllRecordsToApply,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
): Model[] =>
  pipe(
    map((records, tableName: TableName<any>) =>
      prepareApplyRemoteChangesToCollection(
        db.get((tableName: any)),
        records,
        sendCreatedAsUpdated,
        log,
        conflictResolver,
      ),
    ),
    values,
    unnest,
  )(recordsToApply)

// See _unsafeBatchPerCollection - temporary fix
const unsafeBatchesWithRecordsToApply = (
  db: Database,
  recordsToApply: AllRecordsToApply,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
): Promise<void>[] =>
  pipe(
    map((records, tableName: TableName<any>) => {
      const preparedModels = prepareApplyRemoteChangesToCollection(
        db.collections.get((tableName: any)),
        records,
        sendCreatedAsUpdated,
        log,
        conflictResolver,
      )
      return pipe(
        records => splitEvery(5000, records),
        map(recordBatch => db.batch(...recordBatch)),
      )(preparedModels)
    }
    ),
    values,
    unnest,
  )(recordsToApply)

export default function applyRemoteChanges(
  db: Database,
  remoteChanges: SyncDatabaseChangeSet,
  sendCreatedAsUpdated: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
  _unsafeBatchPerCollection?: boolean,
): Promise<void> {
  ensureActionsEnabled(db)
  return db.action(async () => {
    // $FlowFixMe
    const recordsToApply = await getAllRecordsToApply(db, remoteChanges)

    // Perform steps concurrently
    await Promise.all([
      destroyAllDeletedRecords(db, recordsToApply),
      ...(_unsafeBatchPerCollection
        ? unsafeBatchesWithRecordsToApply(
            db,
            recordsToApply,
            sendCreatedAsUpdated,
            log,
            conflictResolver,
          )
        : [
            db.batch(
              // $FlowFixMe
              prepareApplyAllRemoteChanges(
                db,
                recordsToApply,
                sendCreatedAsUpdated,
                log,
                conflictResolver,
              ),
            ),
          ]),
    ])
  }, 'sync-applyRemoteChanges')
}
