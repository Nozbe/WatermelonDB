// @flow

import areRecordsEqual from '../../utils/fp/areRecordsEqual'
import { logError } from '../../utils/common'
import type { Database, Model, TableName } from '../..'

import { prepareMarkAsSynced } from './helpers'
import type { SyncLocalChanges, SyncRejectedIds } from '../index'

const recordsToMarkAsSynced = (
  { changes, affectedRecords }: SyncLocalChanges,
  allRejectedIds: SyncRejectedIds,
): Model[] => {
  const syncedRecords = []

  // perf-critical - index records by table and id, so that each lookup below is O(1)
  const recordsByTable: Map<string, Map<string, Model>> = new Map()
  affectedRecords.forEach((record) => {
    const { table } = record
    let tableRecords = recordsByTable.get(table)
    if (!tableRecords) {
      tableRecords = new Map()
      recordsByTable.set(table, tableRecords)
    }
    tableRecords.set(record.id, record)
  })

  Object.keys(changes).forEach((table) => {
    const { created, updated } = changes[(table: any)]
    const raws = created.concat(updated)
    const rejectedIds = new Set(allRejectedIds[(table: any)])
    const tableRecords = recordsByTable.get(table)

    raws.forEach((raw) => {
      const { id } = raw
      const record = tableRecords && tableRecords.get(id)
      if (!record) {
        logError(
          `[Sync] Looking for record ${table}#${id} to mark it as synced, but I can't find it. Will ignore it (it should get synced next time). This is probably a Watermelon bug — please file an issue!`,
        )
        return
      }
      if (areRecordsEqual(record._raw, raw) && !rejectedIds.has(id)) {
        syncedRecords.push(record)
      }
    })
  })
  return syncedRecords
}

const destroyDeletedRecords = (
  db: Database,
  { changes }: SyncLocalChanges,
  allRejectedIds: SyncRejectedIds,
): Promise<any>[] =>
  Object.keys(changes).map((_tableName) => {
    const tableName: TableName<any> = (_tableName: any)
    const rejectedIds = new Set(allRejectedIds[tableName])
    const deleted = changes[tableName].deleted.filter((id) => !rejectedIds.has(id))
    return deleted.length ? db.adapter.destroyDeletedRecords(tableName, deleted) : Promise.resolve()
  })

export default function markLocalChangesAsSynced(
  db: Database,
  syncedLocalChanges: SyncLocalChanges,
  rejectedIds?: ?SyncRejectedIds,
): Promise<void> {
  return db.write(async () => {
    // update and destroy records concurrently
    await Promise.all([
      db.batch(
        recordsToMarkAsSynced(syncedLocalChanges, rejectedIds || {}).map(prepareMarkAsSynced),
      ),
      ...destroyDeletedRecords(db, syncedLocalChanges, rejectedIds || {}),
    ])
  }, 'sync-markLocalChangesAsSynced')
}
