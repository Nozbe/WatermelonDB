// @flow
/* eslint-disable global-require */

import { NativeModules } from 'react-native'
import { fromPairs } from 'rambdax'
import { connectionTag, type ConnectionTag, logger, invariant } from '../../utils/common'
import {
  type Result,
  type ResultCallback,
  mapValue,
  toPromise,
  fromPromise,
} from '../../utils/fp/Result'

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
  devSetupCallback,
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

type SyncReturn<T> =
  | { status: 'success', result: T }
  | { status: 'error', code: string, message: string }

function syncReturnToResult<T>(syncReturn: SyncReturn<T>): Result<T> {
  if (syncReturn.status === 'success') {
    return { value: syncReturn.result }
  } else if (syncReturn.status === 'error') {
    const error = new Error(syncReturn.message)
    // $FlowFixMem
    error.code = syncReturn.code
    return { error }
  }

  return { error: new Error('Unknown native bridge response') }
}

type NativeDispatcher = $Exact<{
  initialize: (ConnectionTag, string, SchemaVersion, ResultCallback<InitializeStatus>) => void,
  setUpWithSchema: (ConnectionTag, string, SQL, SchemaVersion, ResultCallback<void>) => void,
  setUpWithMigrations: (
    ConnectionTag,
    string,
    SQL,
    SchemaVersion,
    SchemaVersion,
    ResultCallback<void>,
  ) => void,
  find: (ConnectionTag, TableName<any>, RecordId, ResultCallback<DirtyFindResult>) => void,
  query: (ConnectionTag, TableName<any>, SQL, ResultCallback<DirtyQueryResult>) => void,
  count: (ConnectionTag, SQL, ResultCallback<number>) => void,
  batch: (ConnectionTag, NativeBridgeBatchOperation[], ResultCallback<void>) => void,
  batchJSON?: (ConnectionTag, string, ResultCallback<void>) => void,
  getDeletedRecords: (ConnectionTag, TableName<any>, ResultCallback<RecordId[]>) => void,
  destroyDeletedRecords: (ConnectionTag, TableName<any>, RecordId[], ResultCallback<void>) => void,
  unsafeResetDatabase: (ConnectionTag, SQL, SchemaVersion, ResultCallback<void>) => void,
  getLocal: (ConnectionTag, string, ResultCallback<?string>) => void,
  setLocal: (ConnectionTag, string, string, ResultCallback<void>) => void,
  removeLocal: (ConnectionTag, string, ResultCallback<void>) => void,
}>

const dispatcherMethods = [
  'initialize',
  'setUpWithSchema',
  'setUpWithMigrations',
  'find',
  'query',
  'count',
  'batch',
  'batchJSON',
  'getDeletedRecords',
  'destroyDeletedRecords',
  'unsafeResetDatabase',
  'getLocal',
  'setLocal',
  'removeLocal',
]

type NativeBridgeType = {
  // Async methods
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

  // Synchronous methods
  initializeSynchronous?: (ConnectionTag, string, SchemaVersion) => SyncReturn<InitializeStatus>,
  setUpWithSchemaSynchronous?: (ConnectionTag, string, SQL, SchemaVersion) => SyncReturn<void>,
  setUpWithMigrationsSynchronous?: (
    ConnectionTag,
    string,
    SQL,
    SchemaVersion,
    SchemaVersion,
  ) => SyncReturn<void>,
  findSynchronous?: (ConnectionTag, TableName<any>, RecordId) => SyncReturn<DirtyFindResult>,
  querySynchronous?: (ConnectionTag, TableName<any>, SQL) => SyncReturn<DirtyQueryResult>,
  countSynchronous?: (ConnectionTag, SQL) => SyncReturn<number>,
  batchSynchronous?: (ConnectionTag, NativeBridgeBatchOperation[]) => SyncReturn<void>,
  batchJSONSynchronous?: (ConnectionTag, string) => SyncReturn<void>,
  getDeletedRecordsSynchronous?: (ConnectionTag, TableName<any>) => SyncReturn<RecordId[]>,
  destroyDeletedRecordsSynchronous?: (
    ConnectionTag,
    TableName<any>,
    RecordId[],
  ) => SyncReturn<void>,
  unsafeResetDatabaseSynchronous?: (ConnectionTag, SQL, SchemaVersion) => SyncReturn<void>,
  getLocalSynchronous?: (ConnectionTag, string) => SyncReturn<?string>,
  setLocalSynchronous?: (ConnectionTag, string, string) => SyncReturn<void>,
  removeLocalSynchronous?: (ConnectionTag, string) => SyncReturn<void>,
}

const NativeDatabaseBridge: NativeBridgeType = NativeModules.DatabaseBridge

const makeDispatcher = (isSynchronous: boolean): NativeDispatcher => {
  // Hacky-ish way to create a NativeModule-like object which looks like the old DatabaseBridge
  // but dispatches to synchronous methods, while maintaining Flow typecheck at callsite
  const methods = dispatcherMethods.map(methodName => {
    // batchJSON is missing on Android
    if (!NativeDatabaseBridge[methodName]) {
      return [methodName, undefined]
    }

    const name = isSynchronous ? `${methodName}Synchronous` : methodName

    return [
      methodName,
      (...args) => {
        const callback = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        // $FlowFixMe
        const returnValue = NativeDatabaseBridge[name](...otherArgs)

        if (isSynchronous) {
          callback(syncReturnToResult((returnValue: any)))
        } else {
          fromPromise(returnValue, callback)
        }
      },
    ]
  })

  const dispatcher: any = fromPairs(methods)
  return dispatcher
}

export type SQLiteAdapterOptions = $Exact<{
  dbName?: string,
  schema: AppSchema,
  migrations?: SchemaMigrations,
  synchronous?: boolean,
}>

export default class SQLiteAdapter implements DatabaseAdapter, SQLDatabaseAdapter {
  schema: AppSchema

  migrations: ?SchemaMigrations

  _tag: ConnectionTag = connectionTag()

  _dbName: string

  _synchronous: boolean

  _dispatcher: NativeDispatcher

  constructor(options: SQLiteAdapterOptions): void {
    const { dbName, schema, migrations } = options
    this.schema = schema
    this.migrations = migrations
    this._dbName = this._getName(dbName)
    this._synchronous = this._isSynchonous(options.synchronous)
    this._dispatcher = makeDispatcher(this._synchronous)

    if (process.env.NODE_ENV !== 'production') {
      invariant(
        // $FlowFixMe
        options.migrationsExperimental === undefined,
        'SQLiteAdapter `migrationsExperimental` option has been renamed to `migrations`',
      )
      invariant(
        NativeDatabaseBridge,
        `NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for more details`,
      )
      validateAdapter(this)
    }

    fromPromise(this._init(), devSetupCallback)
  }

  _isSynchonous(synchronous: ?boolean): boolean {
    if (synchronous && !NativeDatabaseBridge.initializeSynchronous) {
      logger.warn(
        `Synchronous SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
      )
      return false
    }
    return synchronous || false
  }

  testClone(options?: $Shape<SQLiteAdapterOptions> = {}): SQLiteAdapter {
    return new SQLiteAdapter({
      dbName: this._dbName,
      schema: this.schema,
      synchronous: this._synchronous,
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
    const status = await toPromise(callback =>
      this._dispatcher.initialize(this._tag, this._dbName, this.schema.version, callback),
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
  }

  async _setUpWithMigrations(databaseVersion: SchemaVersion): Promise<void> {
    logger.log('[WatermelonDB][SQLite] Database needs migrations')
    invariant(databaseVersion > 0, 'Invalid database schema version')

    const migrationSteps = this._migrationSteps(databaseVersion)

    if (migrationSteps) {
      logger.log(
        `[WatermelonDB][SQLite] Migrating from version ${databaseVersion} to ${this.schema.version}...`,
      )

      try {
        await toPromise(callback =>
          this._dispatcher.setUpWithMigrations(
            this._tag,
            this._dbName,
            this._encodeMigrations(migrationSteps),
            databaseVersion,
            this.schema.version,
            callback,
          ),
        )
        logger.log('[WatermelonDB][SQLite] Migration successful')
      } catch (error) {
        logger.error('[WatermelonDB][SQLite] Migration failed', error)
        throw error
      }
    } else {
      logger.warn(
        '[WatermelonDB][SQLite] Migrations not available for this version range, resetting database instead',
      )
      await this._setUpWithSchema()
    }
  }

  async _setUpWithSchema(): Promise<void> {
    logger.log(
      `[WatermelonDB][SQLite] Setting up database with schema version ${this.schema.version}`,
    )
    await toPromise(callback =>
      this._dispatcher.setUpWithSchema(
        this._tag,
        this._dbName,
        this._encodedSchema(),
        this.schema.version,
        callback,
      ),
    )
    logger.log(`[WatermelonDB][SQLite] Schema set up successfully`)
  }

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void {
    this._dispatcher.find(this._tag, table, id, result =>
      callback(
        mapValue(rawRecord => sanitizeFindResult(rawRecord, this.schema.tables[table]), result),
      ),
    )
  }

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void {
    this.unsafeSqlQuery(query.table, encodeQuery(query), callback)
  }

  unsafeSqlQuery(
    tableName: TableName<any>,
    sql: string,
    callback: ResultCallback<CachedQueryResult>,
  ): void {
    this._dispatcher.query(this._tag, tableName, sql, result =>
      callback(
        mapValue(
          rawRecords => sanitizeQueryResult(rawRecords, this.schema.tables[tableName]),
          result,
        ),
      ),
    )
  }

  count(query: SerializedQuery, callback: ResultCallback<number>): void {
    const sql = encodeQuery(query, true)
    this._dispatcher.count(this._tag, sql, callback)
  }

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void {
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
    const { batchJSON } = this._dispatcher
    if (batchJSON) {
      batchJSON(this._tag, JSON.stringify(batchOperations), callback)
    } else {
      this._dispatcher.batch(this._tag, batchOperations, callback)
    }
  }

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void {
    this._dispatcher.getDeletedRecords(this._tag, table, callback)
  }

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void {
    this._dispatcher.destroyDeletedRecords(this._tag, table, recordIds, callback)
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this._dispatcher.unsafeResetDatabase(
      this._tag,
      this._encodedSchema(),
      this.schema.version,
      result => {
        if (result.value) {
          logger.log('[WatermelonDB][SQLite] Database is now reset')
        }
        callback(result)
      },
    )
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this._dispatcher.getLocal(this._tag, key, callback)
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    this._dispatcher.setLocal(this._tag, key, value, callback)
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    this._dispatcher.removeLocal(this._tag, key, callback)
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
