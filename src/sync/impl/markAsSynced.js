// @flow

import areRecordsEqual from '../../utils/fp/areRecordsEqual'
import { logError } from '../../utils/common'
import type { Database, Model, TableName } from '../..'

import { prepareMarkAsSynced } from './helpers'
import type { SyncLocalChanges, SyncIds } from '../index'

const recordsToMarkAsSynced = (
  { changes, affectedRecords }: SyncLocalChanges,
  allowOnlyAcceptedIds: boolean,
  allRejectedIds: SyncIds,
  allAcceptedIds: SyncIds,
): Model[] => {
  const syncedRecords = []

  Object.keys(changes).forEach((table) => {
    const { created, updated } = changes[(table: any)]
    const raws = created.concat(updated)
    const rejectedIds = new Set(allRejectedIds[(table: any)])
    const acceptedIds = new Set(allAcceptedIds[(table: any)] || [])

    raws.forEach((raw) => {
      const { id } = raw
      const record = affectedRecords.find((model) => model.id === id && model.table === table)
      if (!record) {
        logError(
          `[Sync] Looking for record ${table}#${id} to mark it as synced, but I can't find it. Will ignore it (it should get synced next time). This is probably a Watermelon bug — please file an issue!`,
        )
        return
      }
      const isAccepted = !allAcceptedIds || !allowOnlyAcceptedIds || acceptedIds.has(id);
      if (areRecordsEqual(record._raw, raw) && !rejectedIds.has(id) && isAccepted) {
        syncedRecords.push(record)
      }
    })
  })
  return syncedRecords
}

const destroyDeletedRecords = (
  db: Database,
  { changes }: SyncLocalChanges,
  allowOnlyAcceptedIds: boolean,
  allRejectedIds: SyncIds,
  allAcceptedIds?: ?SyncIds,
): Promise<any>[] =>
  Object.keys(changes).map((_tableName) => {
    const tableName: TableName<any> = (_tableName: any)
    const rejectedIds = new Set(allRejectedIds[tableName])
    const acceptedIds = new Set(allAcceptedIds[tableName] || [])
    const deleted = changes[tableName].deleted.filter((id) => !rejectedIds.has(id) &&
      (!allAcceptedIds || !allowOnlyAcceptedIds || acceptedIds.has(id)))
    return deleted.length ? db.adapter.destroyDeletedRecords(tableName, deleted) : Promise.resolve()
  })

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
  allowOnlyAcceptedIds: boolean,
  rejectedIds?: ?SyncIds,
  allAcceptedIds?: ?SyncIds,
): Promise<void> {
  return db.write(async () => {
    // update and destroy records concurrently
    await Promise.all([
      db.batch(
        recordsToMarkAsSynced(syncedLocalChanges, allowOnlyAcceptedIds, rejectedIds || {}, 
          allAcceptedIds || {}).map(prepareMarkAsSynced),
      ),
      ...destroyDeletedRecords(db, syncedLocalChanges, allowOnlyAcceptedIds, rejectedIds || {}, 
        allAcceptedIds || {}),
    ])
  }, 'sync-markLocalChangesAsSynced')
}
