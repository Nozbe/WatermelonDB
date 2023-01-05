// @flow

import { mapObj, filterObj, pipe, toPairs } from '../../utils/fp'
import splitEvery from '../../utils/fp/splitEvery'
import allPromisesObj from '../../utils/fp/allPromisesObj'
import { logError, invariant, logger } from '../../utils/common'
import type { Database, RecordId, Collection, Model, TableName, DirtyRaw } from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type {
  SyncTableChangeSet,
  SyncDatabaseChangeSet,
  SyncLog,
  SyncConflictResolver,
  SyncPullStrategy,
} from '../index'
import { prepareCreateFromRaw, prepareUpdateFromRaw } from './helpers'

type ApplyRemoteChangesContext = $Exact<{
  db: Database,
  strategy?: ?SyncPullStrategy,
  sendCreatedAsUpdated?: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
  _unsafeBatchPerCollection?: boolean,
}>

const idsForChanges = ({ created, updated, deleted }: SyncTableChangeSet): RecordId[] => {
  const ids = []
  created.forEach((record) => {
    ids.push(record.id)
  })
  updated.forEach((record) => {
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

type RecordsToApplyRemoteChangesTo<T: Model> = $Exact<{
  ...SyncTableChangeSet,
  recordsMap: Map<RecordId, T>,
  recordsToDestroy: T[],
  locallyDeletedIds: RecordId[],
  deletedRecordsToDestroy: RecordId[],
}>

async function recordsToApplyRemoteChangesTo_incremental<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
  context: ApplyRemoteChangesContext,
): Promise<RecordsToApplyRemoteChangesTo<T>> {
  const { db } = context
  const { table } = collection

  const { deleted: deletedIds } = changes
  const deletedIdsSet = new Set(deletedIds)

  const [records, locallyDeletedIds] = await Promise.all([
    fetchRecordsForChanges(collection, changes),
    db.adapter.getDeletedRecords(table),
  ])

  return {
    ...changes,
    recordsMap: new Map(records.map((record) => [record._raw.id, record])),
    locallyDeletedIds,
    recordsToDestroy: records.filter((record) => deletedIdsSet.has(record.id)),
    deletedRecordsToDestroy: locallyDeletedIds.filter((id) => deletedIdsSet.has(id)),
  }
}

async function recordsToApplyRemoteChangesTo_replacement<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
  context: ApplyRemoteChangesContext,
): Promise<RecordsToApplyRemoteChangesTo<T>> {
  const { db } = context
  const { table } = collection

  const queryForReplacement =
    context.strategy &&
    typeof context.strategy === 'object' &&
    context.strategy.experimentalQueryRecordsForReplacement
      ? context.strategy.experimentalQueryRecordsForReplacement[table]?.()
      : null

  const { created, updated, deleted: changesDeletedIds } = changes
  const deletedIdsSet = new Set(changesDeletedIds)

  // TODO: We can improve memory usage by creating JS records lazily
  // (won't be needed for records that don't change)
  const [records, locallyDeletedIds] = await Promise.all([
    collection.query().fetch(),
    db.adapter.getDeletedRecords(table),
  ])

  // TODO: This is inefficient, as we're already fetching all records
  const replacementRecords = await (async () => {
    if (queryForReplacement) {
      const recordsForReplacement = await collection.query(...queryForReplacement).fetch()
      return new Set(recordsForReplacement.map((record) => record._raw.id))
    }
    return null
  })()

  const recordsToKeep = new Set([
    ...created.map((record) => (record.id: RecordId)),
    ...updated.map((record) => (record.id: RecordId)),
  ])

  return {
    ...changes,
    recordsMap: new Map(records.map((record) => [record._raw.id, record])),
    locallyDeletedIds,
    recordsToDestroy: records.filter((record) => {
      if (deletedIdsSet.has(record._raw.id)) {
        return true
      }

      const subjectToReplacement = replacementRecords
        ? replacementRecords.has(record._raw.id)
        : true

      return (
        subjectToReplacement &&
        !recordsToKeep.has(record._raw.id) &&
        record._raw._status !== 'created'
      )
    }),
    deletedRecordsToDestroy: locallyDeletedIds.filter(
      (id) => !recordsToKeep.has(id) || deletedIdsSet.has(id),
    ),
  }
}

const strategyForCollection = (
  collection: Collection<any>,
  strategy: ?SyncPullStrategy,
): SyncPullStrategy => {
  if (!strategy) {
    return 'incremental'
  } else if (typeof strategy === 'string') {
    return strategy
  }

  return strategy.override[collection.table] || strategy.default
}

async function recordsToApplyRemoteChangesTo<T: Model>(
  collection: Collection<T>,
  changes: SyncTableChangeSet,
  context: ApplyRemoteChangesContext,
): Promise<RecordsToApplyRemoteChangesTo<T>> {
  const strategy = strategyForCollection(collection, context.strategy)
  invariant(['incremental', 'replacement'].includes(strategy), '[Sync] Invalid pull strategy')

  switch (strategy) {
    case 'replacement':
      return recordsToApplyRemoteChangesTo_replacement(collection, changes, context)
    case 'incremental':
    default:
      return recordsToApplyRemoteChangesTo_incremental(collection, changes, context)
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
  recordsToApply: RecordsToApplyRemoteChangesTo<T>,
  collection: Collection<T>,
  context: ApplyRemoteChangesContext,
): Array<?T> {
  const { db, sendCreatedAsUpdated, log, conflictResolver } = context
  const { table } = collection
  const {
    created,
    updated,
    recordsToDestroy: deleted,
    recordsMap,
    locallyDeletedIds,
  } = recordsToApply

  // if `sendCreatedAsUpdated`, server should send all non-deleted records as `updated`
  // log error if it doesn't — but disable standard created vs updated errors
  if (sendCreatedAsUpdated && created.length) {
    logError(
      `[Sync] 'sendCreatedAsUpdated' option is enabled, and yet server sends some records as 'created'`,
    )
  }

  const recordsToBatch: Array<?T> = [] // mutating - perf critical

  // Insert and update records
  created.forEach((raw) => {
    validateRemoteRaw(raw)
    const currentRecord = recordsMap.get(raw.id)
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
      db.adapter.destroyDeletedRecords(table, [raw.id])
      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    } else {
      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    }
  })

  updated.forEach((raw) => {
    validateRemoteRaw(raw)
    const currentRecord = recordsMap.get(raw.id)

    if (currentRecord) {
      recordsToBatch.push(prepareUpdateFromRaw(currentRecord, raw, log, conflictResolver))
    } else if (locallyDeletedIds.includes(raw.id)) {
      // Nothing to do, record was locally deleted, deletion will be pushed later
    } else {
      // Record doesn't exist (but should) — just create it
      !sendCreatedAsUpdated &&
        logError(
          `[Sync] Server wants client to update record ${table}#${raw.id}, but it doesn't exist locally. This could be a serious bug. Will create record instead. If this was intentional, please check the flag sendCreatedAsUpdated in https://nozbe.github.io/WatermelonDB/Advanced/Sync.html#additional-synchronize-flags`,
        )

      recordsToBatch.push(prepareCreateFromRaw(collection, raw))
    }
  })

  deleted.forEach((record) => {
    // $FlowFixMe
    recordsToBatch.push(record.prepareDestroyPermanently())
  })

  return recordsToBatch
}

type AllRecordsToApply = { [TableName<any>]: RecordsToApplyRemoteChangesTo<Model> }

const getAllRecordsToApply = (
  remoteChanges: SyncDatabaseChangeSet,
  context: ApplyRemoteChangesContext,
): AllRecordsToApply => {
  const { db } = context
  return allPromisesObj(
    pipe(
      filterObj((_changes, tableName: TableName<any>) => {
        const collection = db.get((tableName: any))

        if (!collection) {
          logger.warn(
            `You are trying to sync a collection named ${tableName}, but it does not exist. Will skip it (for forward-compatibility). If this is unexpected, perhaps you forgot to add it to your Database constructor's modelClasses property?`,
          )
        }

        return !!collection
      }),
      mapObj((changes, tableName: TableName<any>) => {
        return recordsToApplyRemoteChangesTo(db.get((tableName: any)), changes, context)
      }),
    )(remoteChanges),
  )
}

const destroyAllDeletedRecords = (db: Database, recordsToApply: AllRecordsToApply): Promise<*> => {
  const promises = toPairs(recordsToApply).map(([tableName, { deletedRecordsToDestroy }]) => {
    return deletedRecordsToDestroy.length
      ? db.adapter.destroyDeletedRecords((tableName: any), deletedRecordsToDestroy)
      : null
  })
  return Promise.all(promises)
}

const applyAllRemoteChanges = (
  recordsToApply: AllRecordsToApply,
  context: ApplyRemoteChangesContext,
): Promise<void> => {
  const { db } = context
  const allRecords = []
  toPairs(recordsToApply).forEach(([tableName, records]) => {
    allRecords.push(
      ...prepareApplyRemoteChangesToCollection(records, db.get((tableName: any)), context),
    )
  })
  return db.batch(...allRecords)
}

// See _unsafeBatchPerCollection - temporary fix
const unsafeApplyAllRemoteChangesByBatches = (
  recordsToApply: AllRecordsToApply,
  context: ApplyRemoteChangesContext,
): Promise<*> => {
  const { db } = context
  const promises = []
  toPairs(recordsToApply).forEach(([tableName, records]) => {
    const preparedModels: Array<?Model> = prepareApplyRemoteChangesToCollection(
      records,
      db.get((tableName: any)),
      context,
    )
    const batches = splitEvery(5000, preparedModels).map((recordBatch) => db.batch(...recordBatch))
    promises.push(...batches)
  })
  return Promise.all(promises)
}

export default async function applyRemoteChanges(
  remoteChanges: SyncDatabaseChangeSet,
  context: ApplyRemoteChangesContext,
): Promise<void> {
  const { db, _unsafeBatchPerCollection } = context

  // $FlowFixMe
  const recordsToApply = await getAllRecordsToApply(remoteChanges, context)

  // Perform steps concurrently
  await Promise.all([
    destroyAllDeletedRecords(db, recordsToApply),
    _unsafeBatchPerCollection
      ? unsafeApplyAllRemoteChangesByBatches(recordsToApply, context)
      : applyAllRemoteChanges(recordsToApply, context),
  ])
}
