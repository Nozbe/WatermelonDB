// @flow
/* eslint-disable global-require */

import { connectionTag, type ConnectionTag, logger, invariant } from '../../utils/common'
import {
  type ResultCallback,
  mapValue,
  toPromise,
  fromPromise,
  type Result,
} from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { SerializedQuery } from '../../Query'
import type { TableName, AppSchema, SchemaVersion } from '../../Schema'
import type { SchemaMigrations, MigrationStep } from '../../Schema/migrations'
import type {
  DatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
  UnsafeExecuteOperations,
} from '../type'
import {
  sanitizeFindResult,
  sanitizeQueryResult,
  devSetupCallback,
  validateAdapter,
  validateTable,
} from '../common'
import type {
  DispatcherType,
  SQL,
  SQLiteAdapterOptions,
  SQLiteArg,
  SQLiteQuery,
  NativeBridgeBatchOperation,
  NativeDispatcher,
  MigrationEvents,
} from './type'

import encodeName from './encodeName'
import encodeQuery from './encodeQuery'

import { makeDispatcher, DatabaseBridge, getDispatcherType } from './makeDispatcher'

export type { SQL, SQLiteArg, SQLiteQuery }

if (process.env.NODE_ENV !== 'production') {
  require('./devtools')
}

const IGNORE_CACHE = 0

export default class SQLiteAdapter implements DatabaseAdapter {
  schema: AppSchema

  migrations: ?SchemaMigrations

  _migrationEvents: ?MigrationEvents

  _tag: ConnectionTag = connectionTag()

  _dbName: string

  _dispatcherType: DispatcherType

  _dispatcher: NativeDispatcher

  _initPromise: Promise<void>

  constructor(options: SQLiteAdapterOptions): void {
    // console.log(`---> Initializing new adapter (${this._tag})`)
    const { dbName, schema, migrations, migrationEvents } = options
    this.schema = schema
    this.migrations = migrations
    this._migrationEvents = migrationEvents
    this._dbName = this._getName(dbName)
    this._dispatcherType = getDispatcherType(options)
    // Hacky-ish way to create an object with NativeModule-like shape, but that can dispatch method
    // calls to async, synch NativeModule, or JSI implementation w/ type safety in rest of the impl
    this._dispatcher = makeDispatcher(this._dispatcherType, this._tag, this._dbName)

    if (process.env.NODE_ENV !== 'production') {
      invariant(
        !('experimentalUseJSI' in options),
        'SQLiteAdapter `experimentalUseJSI: true` has been renamed to `jsi: true`',
      )
      invariant(
        !('synchronous' in options),
        'SQLiteAdapter `synchronous: true` was removed. Replace with `jsi: true`, which has the same effect, but with a more modern implementation',
      )
      invariant(
        DatabaseBridge,
        `NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for more details`,
      )
      validateAdapter(this)
    }

    this._initPromise = toPromise((callback) => {
      this._init((result) => {
        callback(result)
        devSetupCallback(result, options.onSetUpError)
      })
    })
  }

  get initializingPromise(): Promise<void> {
    return this._initPromise
  }

  async testClone(options?: $Shape<SQLiteAdapterOptions> = {}): Promise<SQLiteAdapter> {
    // $FlowFixMe
    const clone = new SQLiteAdapter({
      dbName: this._dbName,
      schema: this.schema,
      jsi: this._dispatcherType === 'jsi',
      ...(this.migrations ? { migrations: this.migrations } : {}),
      ...options,
    })
    invariant(
      clone._dispatcherType === this._dispatcherType,
      'testCloned adapter has bad dispatcher type',
    )
    await clone._initPromise
    return clone
  }

  _getName(name: ?string): string {
    if (process.env.NODE_ENV === 'test') {
      return name || `file:testdb${this._tag}?mode=memory&cache=shared`
    }

    return name || 'watermelon'
  }

  _init(callback: ResultCallback<void>): void {
    // Try to initialize the database with just the schema number. If it matches the database,
    // we're good. If not, we try again, this time sending the compiled schema or a migration set
    // This is to speed up the launch (less to do and pass through bridge), and avoid repeating
    // migration logic inside native code
    this._dispatcher.initialize(this._dbName, this.schema.version, (result) => {
      if (result.error) {
        callback(result)
        return
      }

      const status = result.value
      if (status.code === 'schema_needed') {
        this._setUpWithSchema(callback)
      } else if (status.code === 'migrations_needed') {
        this._setUpWithMigrations(status.databaseVersion, callback)
      } else if (status.code !== 'ok') {
        callback({ error: new Error('Invalid database initialization status') })
      } else {
        callback({ value: undefined })
      }
    })
  }

  _setUpWithMigrations(databaseVersion: SchemaVersion, callback: ResultCallback<void>): void {
    logger.log('[SQLite] Database needs migrations')
    invariant(databaseVersion > 0, 'Invalid database schema version')

    const migrationSteps = this._migrationSteps(databaseVersion)

    if (migrationSteps) {
      logger.log(`[SQLite] Migrating from version ${databaseVersion} to ${this.schema.version}...`)

      if (this._migrationEvents && this._migrationEvents.onStart) {
        this._migrationEvents.onStart()
      }

      this._dispatcher.setUpWithMigrations(
        this._dbName,
        this._encodeMigrations(migrationSteps),
        databaseVersion,
        this.schema.version,
        (result) => {
          if (result.error) {
            logger.error('[SQLite] Migration failed', result.error)
            if (this._migrationEvents && this._migrationEvents.onError) {
              this._migrationEvents.onError(result.error)
            }
          } else {
            logger.log('[SQLite] Migration successful')
            if (this._migrationEvents && this._migrationEvents.onSuccess) {
              this._migrationEvents.onSuccess()
            }
          }
          callback(result)
        },
      )
    } else {
      logger.warn(
        '[SQLite] Migrations not available for this version range, resetting database instead',
      )
      this._setUpWithSchema(callback)
    }
  }

  _setUpWithSchema(callback: ResultCallback<void>): void {
    logger.log(`[SQLite] Setting up database with schema version ${this.schema.version}`)
    this._dispatcher.setUpWithSchema(
      this._dbName,
      this._encodedSchema(),
      this.schema.version,
      (result) => {
        if (!result.error) {
          logger.log(`[SQLite] Schema set up successfully`)
        }
        callback(result)
      },
    )
  }

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void {
    validateTable(table, this.schema)
    this._dispatcher.find(table, id, (result) =>
      callback(
        mapValue((rawRecord) => sanitizeFindResult(rawRecord, this.schema.tables[table]), result),
      ),
    )
  }

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void {
    validateTable(query.table, this.schema)
    const { table } = query
    const [sql, args] = encodeQuery(query)
    this._dispatcher.query(table, sql, args, (result) =>
      callback(
        mapValue(
          (rawRecords) => sanitizeQueryResult(rawRecords, this.schema.tables[table]),
          result,
        ),
      ),
    )
  }

  queryIds(query: SerializedQuery, callback: ResultCallback<RecordId[]>): void {
    validateTable(query.table, this.schema)
    const [sql, args] = encodeQuery(query)
    this._dispatcher.queryIds(sql, args, callback)
  }

  unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>): void {
    validateTable(query.table, this.schema)
    const [sql, args] = encodeQuery(query)
    this._dispatcher.unsafeQueryRaw(sql, args, callback)
  }

  count(query: SerializedQuery, callback: ResultCallback<number>): void {
    validateTable(query.table, this.schema)
    const [sql, args] = encodeQuery(query, true)
    this._dispatcher.count(sql, args, callback)
  }

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void {
    this._batch(require('./encodeBatch').default(operations, this.schema), callback)
  }

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void {
    validateTable(table, this.schema)
    const sql = `select id from ${encodeName(table)} where _status='deleted'`
    this._dispatcher.queryIds(sql, [], callback)
  }

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void {
    validateTable(table, this.schema)
    this._batch(
      [[0, null, `delete from "${table}" where "id" == ?`, recordIds.map((id) => [id])]],
      callback,
    )
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this._dispatcher.unsafeResetDatabase(this._encodedSchema(), this.schema.version, (result) => {
      if (result.value) {
        logger.log('[SQLite] Database is now reset')
      }
      callback(result)
    })
  }

  unsafeExecute(operations: UnsafeExecuteOperations, callback: ResultCallback<void>): void {
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        operations &&
          typeof operations === 'object' &&
          Object.keys(operations).length === 1 &&
          Array.isArray(operations.sqls),
        'unsafeExecute expects an { sqls: [ [sql, [args..]], ... ] } object',
      )
    }
    const queries: SQLiteQuery[] = (operations: any).sqls
    this._batch(
      queries.map(([sql, args]) => [IGNORE_CACHE, null, sql, [args]]),
      callback,
    )
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this._dispatcher.getLocal(key, callback)
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    invariant(typeof value === 'string', 'adapter.setLocal() value must be a string')
    this._batch(
      [
        [
          IGNORE_CACHE,
          null,
          `insert or replace into "local_storage" ("key", "value") values (?, ?)`,
          [[key, value]],
        ],
      ],
      callback,
    )
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    this._batch(
      [[IGNORE_CACHE, null, `delete from "local_storage" where "key" == ?`, [[key]]]],
      callback,
    )
  }

  _encodedSchema(): SQL {
    const { encodeSchema } = require('./encodeSchema')
    return encodeSchema(this.schema)
  }

  _migrationSteps(fromVersion: SchemaVersion): ?(MigrationStep[]) {
    const { stepsForMigration } = require('../../Schema/migrations/stepsForMigration')
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

  _batch(batchOperations: NativeBridgeBatchOperation[], callback: ResultCallback<void>): void {
    const { batchJSON } = this._dispatcher
    if (batchJSON) {
      batchJSON(JSON.stringify(batchOperations), callback)
    } else {
      this._dispatcher.batch(batchOperations, callback)
    }
  }
}
