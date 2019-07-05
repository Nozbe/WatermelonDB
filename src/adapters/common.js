// @flow

import { devMeasureTimeAsync, logger, isDevelopment, invariant } from '../utils/common'
import type Model, { RecordId } from '../Model'
import type Query from '../Query'
import type { TableSchema } from '../Schema'
import type { BatchOperation, CachedQueryResult, CachedFindResult, DatabaseAdapter } from './type'
import { sanitizedRaw, type DirtyRaw } from '../RawRecord'

export type DirtyFindResult = RecordId | ?DirtyRaw
export type DirtyQueryResult = Array<RecordId | DirtyRaw>

export function validateAdapter(adapter: DatabaseAdapter): void {
  if (isDevelopment) {
    const { schema, migrations } = adapter
    // TODO: uncomment when full migrations are shipped
    // invariant(migrations, `Missing migrations`)
    if (migrations) {
      invariant(
        migrations.validated,
        `Invalid migrations - use schemaMigrations() to create migrations. See docs for more details.`,
      )

      const { minVersion, maxVersion } = migrations

      invariant(
        maxVersion <= schema.version,
        `Migrations can't be newer than schema. Schema is version ${
          schema.version
        } and migrations cover range from ${minVersion} to ${maxVersion}`,
      )

      invariant(
        maxVersion === schema.version,
        `Missing migration. Database schema is currently at version ${
          schema.version
        }, but migrations only cover range from ${minVersion} to ${maxVersion}`,
      )
    }
  }
}

export function sanitizeFindResult(
  dirtyRecord: DirtyFindResult,
  tableSchema: TableSchema,
): CachedFindResult {
  return dirtyRecord && typeof dirtyRecord === 'object'
    ? sanitizedRaw(dirtyRecord, tableSchema)
    : dirtyRecord
}

export function sanitizeQueryResult(
  dirtyRecords: DirtyQueryResult,
  tableSchema: TableSchema,
): CachedQueryResult {
  return dirtyRecords.map(dirtyRecord =>
    typeof dirtyRecord === 'string' ? dirtyRecord : sanitizedRaw(dirtyRecord, tableSchema),
  )
}

export async function devLogSetUp<T>(executeBlock: () => Promise<T>): Promise<void> {
  try {
    const [, time] = await devMeasureTimeAsync(executeBlock)
    logger.log(`[DB] All set up in ${time}ms`)
  } catch (error) {
    logger.error(`[DB] Uh-oh. Database failed to load, we're in big trouble`, error)
  }
}

export async function devLogFind(
  executeBlock: () => Promise<CachedFindResult>,
  id: string,
  table: string,
): Promise<CachedFindResult> {
  const [data, time] = await devMeasureTimeAsync(executeBlock)
  logger.log(`[DB] Found ${table}#${id} in ${time}ms`)
  return data
}

export async function devLogQuery<T: Model>(
  executeBlock: () => Promise<CachedQueryResult>,
  query: Query<T>,
): Promise<CachedQueryResult> {
  const [dirtyRecords, time] = await devMeasureTimeAsync(executeBlock)
  logger.log(`[DB] Loaded ${dirtyRecords.length} ${query.table} in ${time}ms`)
  return dirtyRecords
}

export async function devLogCount<T: Model>(
  executeBlock: () => Promise<number>,
  query: Query<T>,
): Promise<number> {
  const [count, time] = await devMeasureTimeAsync(executeBlock)
  logger.log(`[DB] Counted ${count} ${query.table} in ${time}ms`)
  return count
}

export async function devLogBatch<T>(
  executeBlock: () => Promise<T>,
  operations: BatchOperation[],
): Promise<void> {
  if (!operations.length) {
    return
  }
  const [, time] = await devMeasureTimeAsync(executeBlock)
  const [type, { table }] = operations[0]
  logger.log(
    `[DB] Executed batch of ${
      operations.length
    } operations (first: ${type} on ${table}) in ${time}ms`,
  )
}
