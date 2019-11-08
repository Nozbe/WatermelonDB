// @flow
/* eslint-disable global-require */

import { NativeModules } from 'react-native'
import { connectionTag, type ConnectionTag, logger, invariant } from '../../utils/common'

import type { RecordId } from '../../Model'
import type { SerializedQuery } from '../../Query'
import type { TableName, AppSchema, SchemaVersion } from '../../Schema'
import type { SchemaMigrations, MigrationStep } from '../../Schema/migrations'
import type {
  DatabaseAdapter,
  SQLDatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
} from '../type'
import {
  type DirtyFindResult,
  type DirtyQueryResult,
  sanitizeFindResult,
  sanitizeQueryResult,
  devLogFind,
  devLogQuery,
  devLogSQLQuery,
  devLogCount,
  devLogBatch,
  devLogSetUp,
  validateAdapter,
} from '../common'

import encodeQuery from './encodeQuery'
import encodeUpdate from './encodeUpdate'
import encodeInsert from './encodeInsert'

export type SQL = string
export type SQLiteArg = string | boolean | number | null
export type SQLiteQuery = [SQL, SQLiteArg[]]

type NativeBridgeBatchOperation =
  | ['execute', TableName<any>, SQL, SQLiteArg[]]
  | ['create', TableName<any>, RecordId, SQL, SQLiteArg[]]
  | ['markAsDeleted', TableName<any>, RecordId]
  | ['destroyPermanently', TableName<any>, RecordId]
// | ['setLocal', string, string]
// | ['removeLocal', string]

type InitializeStatus =
  | { code: 'ok' | 'schema_needed' }
  | { code: 'migrations_needed', databaseVersion: SchemaVersion }

type NativeBridgeType = {
  initialize: (ConnectionTag, string, SchemaVersion) => Promise<InitializeStatus>,
  setUpWithSchema: (ConnectionTag, string, SQL, SchemaVersion) => Promise<void>,
  setUpWithMigrations: (ConnectionTag, string, SQL, SchemaVersion, SchemaVersion) => Promise<void>,
  find: (ConnectionTag, TableName<any>, RecordId) => Promise<DirtyFindResult>,
  query: (ConnectionTag, TableName<any>, SQL) => Promise<DirtyQueryResult>,
  count: (ConnectionTag, SQL) => Promise<number>,
  batch: (ConnectionTag, NativeBridgeBatchOperation[]) => Promise<void>,
  batchJSON?: (ConnectionTag, string) => Promise<void>,
  getDeletedRecords: (ConnectionTag, TableName<any>) => Promise<RecordId[]>,
  destroyDeletedRecords: (ConnectionTag, TableName<any>, RecordId[]) => Promise<void>,
  unsafeResetDatabase: (ConnectionTag, SQL, SchemaVersion) => Promise<void>,
  getLocal: (ConnectionTag, string) => Promise<?string>,
  setLocal: (ConnectionTag, string, string) => Promise<void>,
  removeLocal: (ConnectionTag, string) => Promise<void>,
}
const Native: NativeBridgeType = NativeModules.DatabaseBridge

export type SQLiteAdapterOptions = $Exact<{
  dbName?: string,
  schema: AppSchema,
  migrations?: SchemaMigrations,
}>

export default class SQLiteAdapter implements DatabaseAdapter, SQLDatabaseAdapter {
  schema: AppSchema

  migrations: ?SchemaMigrations

  _tag: ConnectionTag = connectionTag()

  _dbName: string

  constructor(options: SQLiteAdapterOptions): void {
    const { dbName, schema, migrations } = options
    this.schema = schema
    this.migrations = migrations
    this._dbName = this._getName(dbName)

    if (process.env.NODE_ENV !== 'production') {
      invariant(
        // $FlowFixMe
        options.migrationsExperimental === undefined,
        'SQLiteAdapter migrationsExperimental has been renamed to migrations',
      )
      invariant(
        Native,
        `NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for more details`,
      )
      validateAdapter(this)
    }

    devLogSetUp(() => this._init())
  }

  testClone(options?: $Shape<SQLiteAdapterOptions> = {}): SQLiteAdapter {
    return new SQLiteAdapter({
      dbName: this._dbName,
      schema: this.schema,
      ...(this.migrations ? { migrations: this.migrations } : {}),
      ...options,
    })
  }

  _getName(name: ?string): string {
    if (process.env.NODE_ENV === 'test') {
      return name || `file:testdb${this._tag}?mode=memory&cache=shared`
    }

    return name || 'watermelon'
  }

  async _init(): Promise<void> {
    // Try to initialize the database with just the schema number. If it matches the database,
    // we're good. If not, we try again, this time sending the compiled schema or a migration set
    // This is to speed up the launch (less to do and pass through bridge), and avoid repeating
    // migration logic inside native code
    const status = await Native.initialize(this._tag, this._dbName, this.schema.version)

    if (status.code === 'schema_needed') {
      await this._setUpWithSchema()
    } else if (status.code === 'migrations_needed') {
      await this._setUpWithMigrations(status.databaseVersion)
    } else {
      invariant(status.code === 'ok', 'Invalid database initialization status')
    }
  }

  async _setUpWithMigrations(databaseVersion: SchemaVersion): Promise<void> {
    logger.log('[DB] Database needs migrations')
    invariant(databaseVersion > 0, 'Invalid database schema version')

    const migrationSteps = this._migrationSteps(databaseVersion)

    if (migrationSteps) {
      logger.log(`[DB] Migrating from version ${databaseVersion} to ${this.schema.version}...`)

      try {
        await Native.setUpWithMigrations(
          this._tag,
          this._dbName,
          this._encodeMigrations(migrationSteps),
          databaseVersion,
          this.schema.version,
        )
        logger.log('[DB] Migration successful')
      } catch (error) {
        logger.error('[DB] Migration failed', error)
        throw error
      }
    } else {
      logger.warn(
        '[DB] Migrations not available for this version range, resetting database instead',
      )
      await this._setUpWithSchema()
    }
  }

  async _setUpWithSchema(): Promise<void> {
    logger.log(`[DB] Setting up database with schema version ${this.schema.version}`)
    await Native.setUpWithSchema(
      this._tag,
      this._dbName,
      this._encodedSchema(),
      this.schema.version,
    )
    logger.log(`[DB] Schema set up successfully`)
  }

  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    return devLogFind(
      async () =>
        sanitizeFindResult(await Native.find(this._tag, table, id), this.schema.tables[table]),
      table,
      id,
    )
  }

  query(query: SerializedQuery): Promise<CachedQueryResult> {
    return devLogQuery(
      async () =>
        sanitizeQueryResult(
          await Native.query(this._tag, query.table, encodeQuery(query)),
          this.schema.tables[query.table],
        ),
      query,
    )
  }

  unsafeSqlQuery(tableName: TableName<any>, sql: string): Promise<CachedQueryResult> {
    return devLogSQLQuery(
      async () =>
        sanitizeQueryResult(
          await Native.query(this._tag, tableName, sql),
          this.schema.tables[tableName],
        ),
      tableName,
    )
  }

  count(query: SerializedQuery): Promise<number> {
    return devLogCount(() => Native.count(this._tag, encodeQuery(query, true)), query)
  }

  batch(operations: BatchOperation[]): Promise<void> {
    return devLogBatch(async () => {
      const batchOperations: NativeBridgeBatchOperation[] = operations.map(operation => {
        const [type, table, rawOrId] = operation
        switch (type) {
          case 'create': {
            // $FlowFixMe
            return ['create', table, rawOrId.id].concat(encodeInsert(table, rawOrId))
          }
          case 'update': {
            // $FlowFixMe
            return ['execute', table].concat(encodeUpdate(table, rawOrId))
          }
          case 'markAsDeleted':
          case 'destroyPermanently':
            // $FlowFixMe
            return operation // same format, no need to repack
          default:
            throw new Error('unknown batch operation type')
        }
      })
      const { batchJSON } = Native
      if (batchJSON) {
        await batchJSON(this._tag, JSON.stringify(batchOperations))
      } else {
        await Native.batch(this._tag, batchOperations)
      }
    }, operations)
  }

  getDeletedRecords(table: TableName<any>): Promise<RecordId[]> {
    return Native.getDeletedRecords(this._tag, table)
  }

  destroyDeletedRecords(table: TableName<any>, recordIds: RecordId[]): Promise<void> {
    return Native.destroyDeletedRecords(this._tag, table, recordIds)
  }

  async unsafeResetDatabase(): Promise<void> {
    await Native.unsafeResetDatabase(this._tag, this._encodedSchema(), this.schema.version)
    logger.log('[DB] Database is now reset')
  }

  getLocal(key: string): Promise<?string> {
    return Native.getLocal(this._tag, key)
  }

  setLocal(key: string, value: string): Promise<void> {
    return Native.setLocal(this._tag, key, value)
  }

  removeLocal(key: string): Promise<void> {
    return Native.removeLocal(this._tag, key)
  }

  _encodedSchema(): SQL {
    const { encodeSchema } = require('./encodeSchema')
    return encodeSchema(this.schema)
  }

  _migrationSteps(fromVersion: SchemaVersion): ?(MigrationStep[]) {
    const { stepsForMigration } = require('../../Schema/migrations/helpers')
    const { migrations } = this
    // TODO: Remove this after migrations are shipped
    if (!migrations) {
      return null
    }
    return stepsForMigration({
      migrations,
      fromVersion,
      toVersion: this.schema.version,
    })
  }

  _encodeMigrations(steps: MigrationStep[]): SQL {
    const { encodeMigrationSteps } = require('./encodeSchema')
    return encodeMigrationSteps(steps)
  }
}
