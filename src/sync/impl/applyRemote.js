// @flow

import { mapObj, filterObj, pipe, toPairs } from '../../utils/fp'
import splitEvery from '../../utils/fp/splitEvery'
import allPromisesObj from '../../utils/fp/allPromisesObj'
import { toPromise } from '../../utils/fp/Result'
import { logError, invariant, logger } from '../../utils/common'
import type {
  Database,
  RecordId,
  Collection,
  Model,
  TableName,
  DirtyRaw,
  Query,
  RawRecord,
} from '../..'
import * as Q from '../../QueryDescription'
import { columnName } from '../../Schema'

import type {
  SyncTableChangeSet,
  SyncDatabaseChangeSet,
  SyncLog,
  SyncConflictResolver,
  SyncPullStrategy,
} from '../index'
import { prepareCreateFromRaw, prepareUpdateFromRaw, recordFromRaw } from './helpers'

type ApplyRemoteChangesContext = $Exact<{
  db: Database,
  strategy?: ?SyncPullStrategy,
  sendCreatedAsUpdated?: boolean,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
  _unsafeBatchPerCollection?: boolean,
}>

// NOTE: Creating JS models is expensive/memory-intensive, so we want to avoid it if possible
// In replacement sync, we can avoid it if record already exists and didn't change. Note that we're not
// using unsafeQueryRaw, because we DO want to reuse JS model if already in memory
// This is only safe to do within a single db.write block, because otherwise we risk that the record
// changed and we can no longer instantiate a JS model from an outdated raw record
const unsafeFetchAsRaws = async <T: Model>(query: Query<T>) => {
  const { db } = query.collection
  const result = await toPromise((callback) =>
    db.adapter.underlyingAdapter.query(query.serialize(), callback),
  )
  const raws = query.collection._cache.rawRecordsFromQueryResult(result)
  // FIXME: The above actually causes RecordCache corruption, because we're not adding record to
  // RecordCache, but adapter notes that we did. Temporary quick fix below to undo the optimization.
  raws.forEach((raw) => {
    query.collection._cache._modelForRaw(raw, false)
  })

  return raws
}

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
): Promise<RawRecord[]> => {
  const ids = idsForChanges(changes)

  if (ids.length) {
    return unsafeFetchAsRaws(collection.query(Q.where(columnName('id'), Q.oneOf(ids))))
  }

  return Promise.resolve([])
}

type RecordsToApplyRemoteChangesTo<T: Model> = $Exact<{
  ...SyncTableChangeSet,
  recordsMap: Map<RecordId, RawRecord>,
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

  const [rawRecords, locallyDeletedIds] = await Promise.all([
    fetchRecordsForChanges(collection, changes),
    db.adapter.getDeletedRecords(table),
  ])

  return {
    ...changes,
    recordsMap: new Map(rawRecords.map((raw) => [raw.id, raw])),
    locallyDeletedIds,
    recordsToDestroy: rawRecords
      .filter((raw) => deletedIdsSet.has(raw.id))
      .map((raw) => recordFromRaw(raw, collection)),
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

  const [rawRecords, locallyDeletedIds] = await Promise.all([
    unsafeFetchAsRaws(
      collection.query(
        ...(queryForReplacement
          ? [
              Q.or(
                Q.where(columnName('id'), Q.oneOf(idsForChanges(changes))),
                Q.and(...queryForReplacement),
              ),
            ]
          : []),
      ),
    ),
    db.adapter.getDeletedRecords(table),
  ])

  // HACK: We need to figure out which records deleted locally are subject to replacement, but
  // there's no officially supported way to do that, so we're using an internal API and make sure
  // we don't add these to RecordCache. Note that there could be edge cases when using join queries
  // and some of the other referenced records are also deleted.
  const replacementRecords = await (async () => {
    if (queryForReplacement) {
      const modifiedQuery = collection.query(...queryForReplacement)
      modifiedQuery.description = modifiedQuery._rawDescription
      return new Set(await modifiedQuery.fetchIds())
    }
    return null
  })()

  const recordsToKeep = new Set([
    ...created.map((record) => (record.id: RecordId)),
    ...updated.map((record) => (record.id: RecordId)),
  ])

  return {
    ...changes,
    recordsMap: new Map(rawRecords.map((raw) => [raw.id, raw])),
    locallyDeletedIds,
    recordsToDestroy: rawRecords
      .filter((raw) => {
        if (deletedIdsSet.has(raw.id)) {
          return true
        }

        const subjectToReplacement = replacementRecords ? replacementRecords.has(raw.id) : true
        return subjectToReplacement && !recordsToKeep.has(raw.id) && raw._status !== 'created'
      })
      .map((raw) => recordFromRaw(raw, collection)),
    deletedRecordsToDestroy: locallyDeletedIds.filter((id) => {
      if (deletedIdsSet.has(id)) {
        return true
      }
      const subjectToReplacement = replacementRecords ? replacementRecords.has(id) : true
      return subjectToReplacement && !recordsToKeep.has(id)
    }),
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
      recordsToBatch.push(
        prepareUpdateFromRaw(currentRecord, raw, collection, log, conflictResolver),
      )
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
      recordsToBatch.push(
        prepareUpdateFromRaw(currentRecord, raw, collection, log, conflictResolver),
      )
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
  // NOTE: Don't change to `...allRecords` - causes excessive stack usage
  // $FlowFixMe
  return db.batch(allRecords)
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
