// @flow

// don't import the whole utils/ here!
import invariant from '../utils/common/invariant'
import logger from '../utils/common/logger'
import { type Result } from '../utils/fp/Result'
import type { RecordId } from '../Model'
import type { TableSchema, AppSchema, TableName } from '../Schema'
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

export function validateTable(tableName: TableName<any>, schema: AppSchema): void {
  invariant(
    Object.prototype.hasOwnProperty.call(schema.tables, tableName),
    `Could not invoke Adapter method because table name '${tableName}' does not exist in the schema. Most likely, it's a sync bug, and you're sending tables that don't exist in the current version of the app. Or, you made a mistake in migrations. Reminder: it's a serious programming error to pass non-whitelisted table names to Adapter.`,
  )
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

export function devSetupCallback(result: Result<any>, onSetUpError: ?(error: Error) => void): void {
  if (result.error) {
    logger.error(
      `[WatermelonDB] Uh-oh. Database failed to load, we're in big trouble. This might happen if you didn't set up native code correctly (iOS, Android), or if you didn't recompile native app after WatermelonDB update. It might also mean that IndexedDB or SQLite refused to open.`,
      result.error,
    )
    onSetUpError && onSetUpError(result.error)
  }
}
