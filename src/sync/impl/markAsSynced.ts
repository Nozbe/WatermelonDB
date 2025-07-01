import { promiseAllObject, map, reduce, values, pipe, equals } from 'rambdax'
import { unnest } from '../../utils/fp'
import { prepareMarkAsSynced, ensureActionsEnabled } from './helpers'
import type { Database, Model } from '../..'
import type { SyncLocalChanges } from './fetchLocal'

const unchangedRecordsForRaws = (raws: any, recordCache: Array<Model>) =>
  reduce(
    (records, raw) => {
      const record = recordCache.find(model => model.id === (raw as any).id)
      if (!record) {
        return records
      }

      // only include if it didn't change since fetch
      // TODO: get rid of `equals`
      return equals(record._raw, raw) ? records.concat(record as any) : records
    },
    [],
    raws,
  )

const recordsToMarkAsSynced = (
  {
    changes,
    affectedRecords,
  }: SyncLocalChanges,
  // @ts-ignore
): Model[] => pipe(
  values,
  // @ts-ignore
  map(({ created, updated }) =>
    unchangedRecordsForRaws([...created, ...updated], affectedRecords)),
  unnest,
)(changes)

const destroyDeletedRecords = (
  db: Database,
  {
    changes,
  }: SyncLocalChanges,
): Promise<any> => promiseAllObject(
  // @ts-ignore
  map(
    // @ts-ignore
    ({ deleted }, tableName) => db.adapter.destroyDeletedRecords(tableName, deleted),
    changes,
  ),
)

export default function markLocalChangesAsSynced(db: Database, syncedLocalChanges: SyncLocalChanges): Promise<void> {
  ensureActionsEnabled(db)
  return db.action(async () => {
    // update and destroy records concurrently
    await Promise.all([
      db.batch(...map(prepareMarkAsSynced, recordsToMarkAsSynced(syncedLocalChanges))),
      destroyDeletedRecords(db, syncedLocalChanges),
    ])
  }, 'sync-markLocalChangesAsSynced')
}
