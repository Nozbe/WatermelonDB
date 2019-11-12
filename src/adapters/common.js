// @flow

import { logger, invariant } from '../utils/common'
import type { RecordId } from '../Model'
import type { TableSchema } from '../Schema'
import type { CachedQueryResult, CachedFindResult, DatabaseAdapter } from './type'
import { sanitizedRaw, type DirtyRaw } from '../RawRecord'

export type DirtyFindResult = RecordId | ?DirtyRaw
export type DirtyQueryResult = Array<RecordId | DirtyRaw>

export function validateAdapter(adapter: DatabaseAdapter): void {
  if (process.env.NODE_ENV !== 'production') {
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
        `Migrations can't be newer than schema. Schema is version ${schema.version} and migrations cover range from ${minVersion} to ${maxVersion}`,
      )

      invariant(
        maxVersion === schema.version,
        `Missing migration. Database schema is currently at version ${schema.version}, but migrations only cover range from ${minVersion} to ${maxVersion}`,
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
    executeBlock()
  } catch (error) {
    logger.error(
      `[DB] Uh-oh. Database failed to load, we're in big trouble. This might happen if you didn't set up native code correctly (iOS, Android), or if you didn't recompile native app after WatermelonDB update. It might also mean that IndexedDB or SQLite refused to open.`,
      error,
    )
  }
}
