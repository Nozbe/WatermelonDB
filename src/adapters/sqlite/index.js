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
  sanitizeFindResult,
  sanitizeQueryResult,
  devSetupCallback,
  validateAdapter,
} from '../common'
import type {
  SQL,
  SQLiteArg,
  SQLiteQuery,
  NativeBridgeBatchOperation,
  NativeDispatcher,
  NativeBridgeType,
  SyncReturn,
} from './type'

import encodeQuery from './encodeQuery'
import encodeUpdate from './encodeUpdate'
import encodeInsert from './encodeInsert'

export type { SQL, SQLiteArg, SQLiteQuery }

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

const NativeDatabaseBridge: NativeBridgeType = NativeModules.DatabaseBridge

const initializeJSI = () => {
  if (global.nativeWatermelonCreateAdapter) {
    return true
  }

  if (NativeDatabaseBridge.initializeJSI) {
    try {
      NativeDatabaseBridge.initializeJSI()
      return true
    } catch (e) {
      logger.error('[WatermelonDB][SQLite] Failed to initialize JSI')
      logger.error(e)
    }
  }

  return false
}

type DispatcherType = 'asynchronous' | 'synchronous' | 'jsi'

// Hacky-ish way to create an object with NativeModule-like shape, but that can dispatch method
// calls to async, synch NativeModule, or JSI implementation w/ type safety in rest of the impl
const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  dbName: string,
): NativeDispatcher => {
  const jsiDb = type === 'jsi' && global.nativeWatermelonCreateAdapter(dbName)

  const methods = dispatcherMethods.map(methodName => {
    // batchJSON is missing on Android
    if (!NativeDatabaseBridge[methodName] || (methodName === 'batchJSON' && jsiDb)) {
      return [methodName, undefined]
    }

    const name = type === 'synchronous' ? `${methodName}Synchronous` : methodName

    return [
      methodName,
      (...args) => {
        const callback = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        if (jsiDb) {
          try {
            const value =
              methodName === 'query' || methodName === 'count'
                ? jsiDb[methodName](...otherArgs, []) // FIXME: temp workaround
                : jsiDb[methodName](...otherArgs)
            callback({ value })
          } catch (error) {
            callback({ error })
          }
          return
        }

        // $FlowFixMe
        const returnValue = NativeDatabaseBridge[name](tag, ...otherArgs)

        if (type === 'synchronous') {
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
  experimentalUseJSI?: boolean,
}>

export default class SQLiteAdapter implements DatabaseAdapter, SQLDatabaseAdapter {
  schema: AppSchema

  migrations: ?SchemaMigrations

  _tag: ConnectionTag = connectionTag()

  _dbName: string

  _dispatcherType: DispatcherType

  _dispatcher: NativeDispatcher

  constructor(options: SQLiteAdapterOptions): void {
    const { dbName, schema, migrations } = options
    this.schema = schema
    this.migrations = migrations
    this._dbName = this._getName(dbName)
    this._dispatcherType = this._getDispatcherType(options)
    this._dispatcher = makeDispatcher(this._dispatcherType, this._tag, this._dbName)

    if (process.env.NODE_ENV !== 'production') {
      invariant(
        !('migrationsExperimental' in options),
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

  _getDispatcherType(options: SQLiteAdapterOptions): DispatcherType {
    invariant(
      !(options.synchronous && options.experimentalUseJSI),
      '`synchronous` and `experimentalUseJSI` SQLiteAdapter options are mutually exclusive',
    )

    if (options.synchronous) {
      if (NativeDatabaseBridge.initializeSynchronous) {
        return 'synchronous'
      }

      logger.warn(
        `Synchronous SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
      )
    } else if (options.experimentalUseJSI) {
      if (initializeJSI()) {
        return 'jsi'
      }

      logger.warn(
        `JSI SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
      )
    }

    return 'asynchronous'
  }

  testClone(options?: $Shape<SQLiteAdapterOptions> = {}): SQLiteAdapter {
    return new SQLiteAdapter({
      dbName: this._dbName,
      schema: this.schema,
      synchronous: this._dispatcherType === 'synchronous',
      experimentalUseJSI: this._dispatcherType === 'jsi',
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
        this._dbName,
        this._encodedSchema(),
        this.schema.version,
        callback,
      ),
    )
    logger.log(`[WatermelonDB][SQLite] Schema set up successfully`)
  }

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void {
    this._dispatcher.find(table, id, result =>
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
    this._dispatcher.query(tableName, sql, result =>
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
    this._dispatcher.count(sql, callback)
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
      batchJSON(JSON.stringify(batchOperations), callback)
    } else {
      this._dispatcher.batch(batchOperations, callback)
    }
  }

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void {
    this._dispatcher.getDeletedRecords(table, callback)
  }

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void {
    this._dispatcher.destroyDeletedRecords(table, recordIds, callback)
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this._dispatcher.unsafeResetDatabase(this._encodedSchema(), this.schema.version, result => {
      if (result.value) {
        logger.log('[WatermelonDB][SQLite] Database is now reset')
      }
      callback(result)
    })
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this._dispatcher.getLocal(key, callback)
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    this._dispatcher.setLocal(key, value, callback)
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    this._dispatcher.removeLocal(key, callback)
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
