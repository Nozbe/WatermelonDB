// @flow
/* eslint-disable no-continue */

import forEachAsync from '../../utils/fp/forEachAsync'
import type { DirtyRaw } from '../..'
import { hasUnsyncedChanges } from '../../sync'
import { sanitizedRaw } from '../../RawRecord'
import { getLastPulledAt } from '../../sync/impl'
import { changeSetCount } from '../../sync/impl/helpers'
import censorRaw from '../censorRaw'
import type { DiagnoseSyncConsistencyOptions, SyncConsistencyDiagnosis } from './index'

const yieldLog = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

const recordsToMap = (records: Object): Map<string, Object> => {
  const map = new Map()
  records.forEach((record) => {
    if (map.has(record.id)) {
      throw new Error(`❌ Array of records has a duplicate ID ${record.id}`)
    }
    map.set(record.id, record)
  })
  return map
}

const renderRecord = (record: DirtyRaw) => {
  // eslint-disable-next-line no-unused-vars
  const { _status, _changed, ...rest } = record
  return JSON.stringify(censorRaw(rest), null, '  ')
}

// Indicates uncertainty whether local and remote states are fully synced - requires a retry
class InconsistentSyncError extends Error {}

async function diagnoseSyncConsistencyImpl(
  {
    db,
    synchronize,
    pullChanges,
    isInconsistentRecordAllowed = async () => false,
    isExcessLocalRecordAllowed = async () => false,
    isMissingLocalRecordAllowed = async () => false,
  }: DiagnoseSyncConsistencyOptions,
  log: (text?: string) => void,
): Promise<number> {
  log('# Sync consistency diagnostics')
  log()

  let totalCorruptionCount = 0

  // synchronize first, to ensure we're at consistent state
  // (twice to deal with just-resolved conflicts or data just pushed)
  log('Syncing once...')
  await synchronize()
  log('Syncing twice...')
  await synchronize()
  log('Synced.')

  // disallow further local changes
  await db.read(async (reader) => {
    // ensure no more local changes
    if (await reader.callReader(() => hasUnsyncedChanges({ database: db }))) {
      log(
        '❌ Sync consistency diagnostics failed because there are unsynced local changes - please try again.',
      )
      throw new InconsistentSyncError('unsynced local changes')
    }
    log()

    // fetch ALL data
    log('Fetching all data. This may take a while (same as initial login), please be patient...')
    const { schema } = db
    const allUserData = await pullChanges({
      lastPulledAt: null,
      schemaVersion: schema.version,
      migration: null,
    })
    log(`Fetched all ${changeSetCount(allUserData)} records`)

    // Ensure that all data is consistent with current data - if so,
    // an incremental sync will be empty
    // NOTE: Fetching all data takes enough time that there's a great risk
    // that many test will fail here. It would be easier to fetch all data
    // first and then do a quick incremental sync, but that doesn't give us
    // a guarantee of consistency
    log(`Ensuring no new remote changes...`)
    const lastPulledAt = await getLastPulledAt(db)
    const recentChanges = await pullChanges({
      lastPulledAt,
      schemaVersion: schema.version,
      migration: null,
    })

    const recentChangeCount = changeSetCount(recentChanges)
    if (recentChangeCount > 0) {
      log(
        `❌ Sync consistency diagnostics failed because there were changes on the server between initial synchronization and now. Please try again.`,
      )
      log()
      throw new InconsistentSyncError(
        'there were changes on the server between initial synchronization and now',
      )
    }
    log()

    // Compare all the data
    const collections = Object.keys(db.collections.map)
    await forEachAsync(collections, async (table) => {
      log(`## Consistency of \`${table}\``)
      log()
      await yieldLog()

      let tableCorruptionCount = 0

      const records = await db.collections
        // $FlowFixMe
        .get(table)
        .query()
        .fetch()

      // $FlowFixMe
      const { created, updated, deleted } = allUserData[table]
      if (deleted.length) {
        log(
          `❓ Warning: ${deleted.length} deleted ${table} found in full (login) sync -- should not be necessary:`,
        )
        log(deleted.join(','))
      }

      const remoteRecords = created.concat(updated)
      log(`Found ${records.length} \`${table}\` locally, ${remoteRecords.length} remotely`)

      // Transform records into hash maps for efficient lookup
      const localMap = recordsToMap(records.map((r) => r._raw))

      // $FlowFixMe
      const tableSchema = schema.tables[table]
      const remoteMap = recordsToMap(remoteRecords.map((r) => sanitizedRaw(r, tableSchema)))
      await yieldLog()

      const inconsistentRecords = []
      const excessRecords = []
      const missingRecords = []

      await forEachAsync(Array.from(remoteMap.entries()), async ([id, remote]) => {
        const local = localMap.get(id)
        if (!local) {
          if (await isMissingLocalRecordAllowed({ tableName: table, remote })) {
            missingRecords.push(id)
          } else {
            log()
            log(
              `❌ MISSING: Record \`${table}.${id}\` is present on server, but missing in local db`,
            )
            log()
            log('```')
            log(`REMOTE: ${renderRecord(remote)}`)
            log('```')
            tableCorruptionCount += 1
          }
        }
      })
      await yieldLog()

      const columnsToCheck: string[] = tableSchema.columnArray.map((column) => column.name)

      await forEachAsync(Array.from(localMap.entries()), async ([id, record]) => {
        const local: any = record
        const remote = remoteMap.get(id)
        // console.log(id, local, remote)
        if (!remote) {
          if (await isExcessLocalRecordAllowed({ tableName: table, local })) {
            excessRecords.push(id)
          } else {
            log()
            log(`❌ EXCESS: Record \`${table}.${id}\` is present in local db, but not on server`)
            log()
            log('```')
            log(`LOCAL: ${renderRecord(local)}`)
            log('```')
            tableCorruptionCount += 1
          }
        } else {
          const recordIsConsistent =
            local.id === remote.id &&
            local._status === 'synced' &&
            local._changed === '' &&
            columnsToCheck.every((column) => local[column] === remote[column])

          if (!recordIsConsistent) {
            const inconsistentColumns = columnsToCheck.filter(
              (column) => local[column] !== remote[column],
            )

            if (
              await isInconsistentRecordAllowed({
                tableName: table,
                local,
                remote,
                inconsistentColumns,
              })
            ) {
              inconsistentRecords.push(id)
            } else {
              tableCorruptionCount += 1
              log()
              log(`❌ INCONSISTENCY: Record \`${table}.${id}\` differs between server and local db`)
              log()
              log('```')
              log(`LOCAL: ${renderRecord(local)}`)
              log(`REMOTE: ${renderRecord(remote)}`)
              log(`DIFFERENCE:`)
              inconsistentColumns.forEach((column) => {
                log(
                  `- ${column} | local: ${JSON.stringify(local[column])} | remote: ${JSON.stringify(
                    remote[column],
                  )}`,
                )
              })
              log('```')
            }
          }
        }
      })

      log()

      if (inconsistentRecords.length) {
        log(`❓ Config allowed ${inconsistentRecords.length} inconsistent \`${table}\``)
        // log(inconsistentRecords.join(','))
      }
      if (excessRecords.length) {
        log(`❓ Config allowed ${excessRecords.length} excess local \`${table}\``)
        // log(excessRecords.join(','))
      }
      if (missingRecords.length) {
        log(`❓ Config allowed ${missingRecords.length} locally missing \`${table}\``)
        // log(missingRecords.join(','))
      }

      if (!tableCorruptionCount) {
        log(`No corruption found in this table`)
      }
      totalCorruptionCount += tableCorruptionCount
      log()
      await yieldLog()
    })

    log('## Conclusion')
    log()
    if (totalCorruptionCount) {
      log(`❌ ${totalCorruptionCount} issues found`)
    } else {
      log(`✅ No corruption found in this database!`)
    }
  })

  return totalCorruptionCount
}

export default async function diagnoseSyncConsistency(
  options: DiagnoseSyncConsistencyOptions,
): Promise<SyncConsistencyDiagnosis> {
  const startTime = Date.now()
  let logText = ''
  const log = (text: string = '') => {
    logText = `${logText}\n${text}`
    options.log?.(text)
  }

  // If we're not sure if we've synced properly (can't do it transactionally, we always have to check
  // if there are new changes), retry
  let allowedAttempts = 5
  // eslint-disable-next-line no-constant-condition
  while (true) {
    allowedAttempts -= 1
    try {
      // eslint-disable-next-line no-await-in-loop
      const issueCount = await diagnoseSyncConsistencyImpl(options, log)

      log()
      log(`Done in ${(Date.now() - startTime) / 1000} s.`)
      return { issueCount, log: logText }
    } catch (error) {
      if (error instanceof InconsistentSyncError && allowedAttempts >= 1) {
        continue // retry
      } else {
        throw error
      }
    }
  }
  // eslint-disable-next-line no-unreachable
  throw new Error('unreachable')
}
