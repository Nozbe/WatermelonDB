// @flow

import {
  mapObj,
  values,
  unnest,
} from '../../utils/fp'
import areRecordsEqual from '../../utils/fp/areRecordsEqual'
import allPromisesObj from '../../utils/fp/allPromisesObj'
import { logError } from '../../utils/common'
import type { Database, Model } from '../..'

import { prepareMarkAsSynced, ensureActionsEnabled } from './helpers'
import type { SyncLocalChanges } from '../index'

const unchangedRecordsForRaws = (raws, recordCache) =>
  raws.reduce(
    (records, raw) => {
      const record = recordCache.find(model => model.id === raw.id)
      if (!record) {
        logError(
          `[Sync] Looking for record ${raw.id} to mark it as synced, but I can't find it. Will ignore it (it should get synced next time). This is probably a Watermelon bug — please file an issue!`,
        )
        return records
      }

      // only include if it didn't change since fetch
      return areRecordsEqual(record._raw, raw) ? records.concat(record) : records
    },
    [],
  )

const recordsToMarkAsSynced = ({ changes, affectedRecords }: SyncLocalChanges): Model[] => {
  // $FlowFixMe
  const changesTables = values(changes)
  return unnest(
    // $FlowFixMe
    changesTables.map(({ created, updated }) =>
      unchangedRecordsForRaws(created.concat(updated), affectedRecords),
    )
  )
}

const destroyDeletedRecords = (db: Database, { changes }: SyncLocalChanges): Promise<*> =>
  allPromisesObj(
    // $FlowFixMe
    mapObj(({ deleted }, tableName) => db.adapter.destroyDeletedRecords(tableName, deleted), changes),
  )

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
): Promise<void> {
  ensureActionsEnabled(db)
  return db.action(async () => {
    // update and destroy records concurrently
    await Promise.all([
      // $FlowFixMe
      db.batch(recordsToMarkAsSynced(syncedLocalChanges).map(prepareMarkAsSynced)),
      destroyDeletedRecords(db, syncedLocalChanges),
    ])
  }, 'sync-markLocalChangesAsSynced')
}
