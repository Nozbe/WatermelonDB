// @flow
/* eslint-disable global-require */

import { connectionTag, type ConnectionTag, logger, invariant } from '../../utils/common'
import { type ResultCallback, mapValue, toPromise, fromPromise } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { SerializedQuery } from '../../Query'
import type { TableName, AppSchema, SchemaVersion } from '../../Schema'
import type { SchemaMigrations, MigrationStep } from '../../Schema/migrations'
import type { DatabaseAdapter, CachedQueryResult, CachedFindResult, BatchOperation } from '../type'
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
import encodeUpdate from './encodeUpdate'
import encodeInsert from './encodeInsert'

import { makeDispatcher, DatabaseBridge, getDispatcherType } from './makeDispatcher'

export type { SQL, SQLiteArg, SQLiteQuery }

if (process.env.NODE_ENV !== 'production') {
  require('./devtools')
}

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

    this._initPromise = this._init()
    fromPromise(this._initPromise, (result) => devSetupCallback(result, options.onSetUpError))
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

  async _init(): Promise<void> {
    // Try to initialize the database with just the schema number. If it matches the database,
    // we're good. If not, we try again, this time sending the compiled schema or a migration set
    // This is to speed up the launch (less to do and pass through bridge), and avoid repeating
    // migration logic inside native code
    const status = await toPromise((callback) =>
      this._dispatcher.initialize(this._dbName, this.schema.version, callback),
    )

    // NOTE: Race condition - logic here is asynchronous, but synchronous-mode adapter does not allow
    // for queueing operations. will fail if you start making actions immediately
    if (status.code === 'schema_needed') {
      await this._setUpWithSchema()
    } else if (status.code === 'migrations_needed') {
      await this._setUpWithMigrations(status.databaseVersion)
    } else {
      invariant(status.code === 'ok', 'Invalid database initialization status')
    }

    // console.log(`---> Done initializing (${this._tag})`)
  }

  async _setUpWithMigrations(databaseVersion: SchemaVersion): Promise<void> {
    logger.log('[SQLite] Database needs migrations')
    invariant(databaseVersion > 0, 'Invalid database schema version')

    const migrationSteps = this._migrationSteps(databaseVersion)

    if (migrationSteps) {
      logger.log(`[SQLite] Migrating from version ${databaseVersion} to ${this.schema.version}...`)

      if (this._migrationEvents && this._migrationEvents.onStart) {
        this._migrationEvents.onStart()
      }

      try {
        await toPromise((callback) =>
          this._dispatcher.setUpWithMigrations(
            this._dbName,
            this._encodeMigrations(migrationSteps),
            databaseVersion,
            this.schema.version,
            callback,
          ),
        )
        logger.log('[SQLite] Migration successful')
        if (this._migrationEvents && this._migrationEvents.onSuccess) {
          this._migrationEvents.onSuccess()
        }
      } catch (error) {
        logger.error('[SQLite] Migration failed', error)
        if (this._migrationEvents && this._migrationEvents.onError) {
          this._migrationEvents.onError(error)
        }
        throw error
      }
    } else {
      logger.warn(
        '[SQLite] Migrations not available for this version range, resetting database instead',
      )
      await this._setUpWithSchema()
    }
  }

  async _setUpWithSchema(): Promise<void> {
    logger.log(`[SQLite] Setting up database with schema version ${this.schema.version}`)
    await toPromise((callback) =>
      this._dispatcher.setUpWithSchema(
        this._dbName,
        this._encodedSchema(),
        this.schema.version,
        callback,
      ),
    )
    logger.log(`[SQLite] Schema set up successfully`)
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

  count(query: SerializedQuery, callback: ResultCallback<number>): void {
    validateTable(query.table, this.schema)
    const [sql, args] = encodeQuery(query, true)
    this._dispatcher.count(sql, args, callback)
  }

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void {
    const batchOperations: NativeBridgeBatchOperation[] = operations.map((operation) => {
      const [type, table, rawOrId] = operation
      validateTable(table, this.schema)
      switch (type) {
        case 'create': {
          // $FlowFixMe
          return ['create', table, rawOrId.id].concat(
            encodeInsert(this.schema.tables[table], (rawOrId: any)),
          )
        }
        case 'update': {
          // $FlowFixMe
          return ['execute'].concat(encodeUpdate(table, rawOrId))
        }
        case 'markAsDeleted':
        case 'destroyPermanently':
          // $FlowFixMe
          return operation // same format, no need to repack
        default:
          throw new Error('unknown batch operation type')
      }
    })
    this._batch(batchOperations, callback)
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
    this._dispatcher.destroyDeletedRecords(table, recordIds, callback)
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this._dispatcher.unsafeResetDatabase(this._encodedSchema(), this.schema.version, (result) => {
      if (result.value) {
        logger.log('[SQLite] Database is now reset')
      }
      callback(result)
    })
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this._dispatcher.getLocal(key, callback)
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    this._batch(
      [
        [
          'execute',
          `insert or replace into "local_storage" ("key", "value") values (?, ?)`,
          [key, value],
        ],
      ],
      callback,
    )
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    this._batch([['execute', `delete from "local_storage" where "key" == ?`, [key]]], callback)
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
