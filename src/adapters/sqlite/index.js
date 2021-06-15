// @flow
/* eslint-disable global-require */

import { connectionTag, type ConnectionTag, logger, invariant } from '../../utils/common'
import { type ResultCallback, mapValue, toPromise } from '../../utils/fp/Result'
import { mapObj } from '../../utils/fp'

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
  SqliteDispatcher,
  MigrationEvents,
} from './type'

import encodeQuery from './encodeQuery'

import { makeDispatcher, getDispatcherType } from './makeDispatcher'

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

  _dispatcher: SqliteDispatcher

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
    this._dispatcher.call('initialize', [this._dbName, this.schema.version], (result) => {
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

      this._dispatcher.call(
        'setUpWithMigrations',
        [
          this._dbName,
          require('./encodeSchema').encodeMigrationSteps(migrationSteps),
          databaseVersion,
          this.schema.version,
        ],
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
    this._dispatcher.call(
      'setUpWithSchema',
      [this._dbName, this._encodedSchema(), this.schema.version],
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
    this._dispatcher.call('find', [table, id], (result) =>
      callback(
        mapValue((rawRecord) => sanitizeFindResult(rawRecord, this.schema.tables[table]), result),
      ),
    )
  }

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void {
    validateTable(query.table, this.schema)
    const { table } = query
    const [sql, args] = encodeQuery(query)
    this._dispatcher.call('query', [table, sql, args], (result) =>
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
    this._dispatcher.call(
      'queryIds',
      // $FlowFixMe
      encodeQuery(query),
      callback,
    )
  }

  unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>): void {
    validateTable(query.table, this.schema)
    this._dispatcher.call(
      'unsafeQueryRaw',
      // $FlowFixMe
      encodeQuery(query),
      callback,
    )
  }

  count(query: SerializedQuery, callback: ResultCallback<number>): void {
    validateTable(query.table, this.schema)
    this._dispatcher.call(
      'count',
      // $FlowFixMe
      encodeQuery(query, true),
      callback,
    )
  }

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void {
    this._dispatcher.call(
      'batch',
      [require('./encodeBatch').default(operations, this.schema)],
      callback,
    )
  }

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void {
    validateTable(table, this.schema)
    this._dispatcher.call(
      'queryIds',
      [`select id from "${table}" where _status='deleted'`, []],
      callback,
    )
  }

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void {
    validateTable(table, this.schema)
    const operation = [
      0,
      null,
      `delete from "${table}" where "id" == ?`,
      recordIds.map((id) => [id]),
    ]
    this._dispatcher.call('batch', [[operation]], callback)
  }

  unsafeLoadFromSync(syncPullResultJson: string, callback: ResultCallback<any>): void {
    if (this._dispatcherType !== 'jsi') {
      callback({ error: new Error('unsafeLoadFromSync unavailable') })
    }

    // TODO: Recreate indices
    this._dispatcher.call('unsafeLoadFromSync', [syncPullResultJson, this.schema], (result) =>
      callback(
        mapValue(
          // { key: JSON.stringify(value) } -> { key: value }
          (residualValues) => mapObj((values) => JSON.parse(values), residualValues),
          result,
        ),
      ),
    )
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this._dispatcher.call(
      'unsafeResetDatabase',
      [this._encodedSchema(), this.schema.version],
      (result) => {
        if (result.value) {
          logger.log('[SQLite] Database is now reset')
        }
        callback(result)
      },
    )
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
    const batchOperations = queries.map(([sql, args]) => [IGNORE_CACHE, null, sql, [args]])
    this._dispatcher.call('batch', [batchOperations], callback)
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this._dispatcher.call('getLocal', [key], callback)
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    invariant(typeof value === 'string', 'adapter.setLocal() value must be a string')
    const operation = [
      IGNORE_CACHE,
      null,
      `insert or replace into "local_storage" ("key", "value") values (?, ?)`,
      [[key, value]],
    ]
    this._dispatcher.call('batch', [[operation]], callback)
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    const operation = [IGNORE_CACHE, null, `delete from "local_storage" where "key" == ?`, [[key]]]
    this._dispatcher.call('batch', [[operation]], callback)
  }

  _encodedSchema(): SQL {
    return require('./encodeSchema').encodeSchema(this.schema)
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
}
