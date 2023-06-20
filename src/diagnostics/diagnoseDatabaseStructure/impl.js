// @flow
/* eslint-disable no-continue */

import forEachAsync from '../../utils/fp/forEachAsync'
import type { Database } from '../..'
import { columnName } from '../../Schema'
import * as Q from '../../QueryDescription'
import censorRaw from '../censorRaw'
import type { DiagnoseDatabaseStructureOptions, DatabaseStructureDiagnosis } from './index'

const pad = (text: string, len: number) => {
  const padding = Array(Math.max(0, len - text.length))
    .fill(' ')
    .join('')
  return `${text}${padding}`
}

const yieldLog = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

const getCollections = (db: Database) =>
  Object.entries(db.collections.map).map(([table, collection]) => {
    return {
      name: table,
      // $FlowFixMe
      parents: Object.entries(collection.modelClass.associations)
        // $FlowFixMe
        .filter(([, association]) => association.type === 'belongs_to')
        // $FlowFixMe
        .map(([parentTable, association]) => [parentTable, association.key]),
    }
  })

const logCollections = (
  log: (text?: string) => void,
  collections: Array<$Exact<{ name: string, parents: Array<Array<any | string>> }>>,
) => {
  collections.forEach(({ name, parents }) => {
    const parentsText = parents.length
      ? parents.map(([table, key]) => pad(`${table}(${key})`, 27)).join(', ')
      : '(root)'

    log(`- ${pad(name, 20)}: ${parentsText}`)
  })
  log()
}

const isUniqueIndexValid = (collection: any, key: string) => {
  const index = collection.constraints.unique[key]

  if (!index) {
    return { skip: true }
  }

  const lokiMap = Object.entries(index.lokiMap)
  // >= and undefined checks are needed because items are not removed from unique index, just made undefined
  const lokiMapValid =
    lokiMap.length >= collection.data.length &&
    lokiMap.every(([lokiId, value]) => value === undefined || collection.get(lokiId)[key] === value)

  const keyMap = Object.entries(index.keyMap)
  const keyMapValid =
    keyMap.length >= collection.data.length &&
    keyMap.every(
      ([value, record]) =>
        record === undefined ||
        // $FlowFixMe
        (record[key] === value && collection.get(record.$loki) === record),
    )

  return { skip: false, lokiMapValid, keyMapValid }
}

async function verifyLokiIndices(db: Database, log: (text?: string) => void): Promise<number> {
  log('## Verify LokiJS indices')
  let issueCount = 0

  // $FlowFixMe
  const { loki } = db.adapter.underlyingAdapter._driver
  loki.collections.forEach((collection) => {
    const { name, idIndex, data, binaryIndices, uniqueNames } = collection
    log(`**Indices of \`${name}\`**`)
    log()

    // check idIndex
    if (idIndex) {
      if (
        idIndex.length === data.length &&
        idIndex.every((lokiId, i) => data[i].$loki === lokiId)
      ) {
        log('idIndex: ok')
      } else {
        log('❌ idIndex: corrupted!')
        issueCount += 1
      }
    } else {
      log('idIndex: (skipping)')
    }

    // check binary indices
    const binKeys = Object.keys(binaryIndices)
    binKeys.forEach((binKey) => {
      if (collection.checkIndex(binKey, { repair: true })) {
        log(`${binKey} binary index: ok`)
      } else {
        log(`❌ ${binKey} binary index: corrupted! checking if repaired...`)
        issueCount += 1

        if (collection.checkIndex(binKey)) {
          log('repaired ok')
        } else {
          log('❌❌ still broken after repair!')
        }
      }
    })

    // check unique indices
    if (name !== 'local_storage' && !(uniqueNames.length === 1 && uniqueNames[0] === 'id')) {
      log(`❌ expected to only have a single unique index for 'id', has: ${uniqueNames.join(', ')}`)
      issueCount += 1
    }

    uniqueNames.forEach((key) => {
      const results = isUniqueIndexValid(collection, key)
      if (!results.skip) {
        if (results.lokiMapValid) {
          log(`${key} index loki map: ok`)
        } else {
          log(`❌ ${key} index loki map: corrupted!`)
          issueCount += 1
        }

        if (results.keyMapValid) {
          log(`${key} index key map: ok`)
        } else {
          log(`❌ ${key} index key map: corrupted!`)
          issueCount += 1
        }
      } else {
        log(`${key} index: (skipping)`)
      }
    })
    log()
  })

  return issueCount
}

export default function diagnoseDatabaseStructure({
  db,
  log: _log = () => {},
  shouldSkipParent = () => false,
  isOrphanAllowed = async () => false,
}: DiagnoseDatabaseStructureOptions): Promise<DatabaseStructureDiagnosis> {
  return db.read(async () => {
    const startTime = Date.now()
    let logText = ''
    const log = (text: string = '') => {
      logText = `${logText}\n${text}`
      _log(text)
    }

    let totalIssueCount = 0

    log('# Database structure diagnostics')
    log()

    if ((db.adapter.underlyingAdapter.constructor: any).adapterType === 'loki') {
      // eslint-disable-next-line require-atomic-updates
      totalIssueCount += await verifyLokiIndices(db, log)
    }

    log('## Collection parent-child relations')
    log()

    const collections = getCollections(db)
    // log(JSON.stringify(collections, null, 2))
    log('```')
    logCollections(log, collections)
    log('```')
    await yieldLog()

    await forEachAsync(collections, async ({ name, parents }) => {
      log(`## Structure of ${name}`)
      log()

      if (!parents.length) {
        log(`(skipping - no parents)`)
        log()
        return
      }
      await yieldLog()

      const records = await db.collections
        // $FlowFixMe
        .get(name)
        .query()
        .fetch()
      log(`Found ${records.length} \`${name}\``)
      await yieldLog()

      let collectionOrphanCount = 0

      await forEachAsync(parents, async ([parentName, key]) => {
        const expectedParentSet = new Set([])
        records.forEach((record) => {
          const id = record._getRaw(key)
          if (
            id !== null &&
            !shouldSkipParent({
              tableName: (name: any),
              parentTableName: (parentName: any),
              relationKey: (key: any),
              record: record._raw,
            })
          ) {
            expectedParentSet.add(id)
          }
        })
        const expectedParents = [...expectedParentSet]
        const parentsFound = await db.collections
          // $FlowFixMe
          .get(parentName)
          // $FlowFixMe
          .query(Q.where(columnName('id'), Q.oneOf(expectedParents)))
          .fetch()
        log()
        log(`Found ${parentsFound.length} parent \`${parentName}\` (via \`${name}.${key}\`)`)

        const allowedOprhans = []

        if (parentsFound.length !== expectedParents.length) {
          const foundParentSet = new Set(parentsFound.map((record) => record.id))
          const orphans = []

          await forEachAsync(records, async (record) => {
            const parentId = record._getRaw(key)
            if (
              parentId === null ||
              foundParentSet.has(parentId) ||
              shouldSkipParent({
                tableName: (name: any),
                parentTableName: (parentName: any),
                relationKey: (key: any),
                record: record._raw,
              })
            ) {
              // ok
            } else if (
              await isOrphanAllowed({
                tableName: (name: any),
                parentTableName: (parentName: any),
                relationKey: (key: any),
                record: record._raw,
              })
            ) {
              allowedOprhans.push(record)
            } else {
              orphans.push(record)
            }
          })

          if (orphans.length) {
            collectionOrphanCount += orphans.length
            log(
              `❌ Error! ${
                expectedParents.length - parentsFound.length
              } missing parent \`${parentName}\` across ${orphans.length} orphans:`,
            )
            orphans.forEach((orphan) => {
              log()
              log(`MISSING PARENT \`${parentName}.${orphan._getRaw(key)} (via ${key})\`:`)
              log()
              log('```')
              log(`${JSON.stringify(censorRaw(orphan._raw), null, '  ')}`)
              log('```')
            })
          }
          await yieldLog()

          if (allowedOprhans.length) {
            log(`❓ Config allowed ${allowedOprhans.length} orphans for this field`)
            // log(allowedOprhans.join(','))
          }
        }

        await yieldLog()
      })

      if (!collectionOrphanCount) {
        // log(`No orphans found in ${name}`)
      }
      totalIssueCount += collectionOrphanCount
      log()
    })

    log('## Conclusion')
    log()
    if (totalIssueCount) {
      log(`❌ ${totalIssueCount} issues found`)
    } else {
      log(`✅ No issues found in this database!`)
    }

    log()
    log(`Done in ${(Date.now() - startTime) / 1000} s.`)
    return { issueCount: totalIssueCount, log: logText }
  })
}
