import type { ConnectionTag } from '../../utils/common'
import type { ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { SerializedQuery } from '../../Query'
import type { AppSchema, SchemaVersion, TableName } from '../../Schema'
import type { MigrationStep, SchemaMigrations} from '../../Schema/migrations'
import type {
  BatchOperation,
  CachedFindResult,
  CachedQueryResult,
  DatabaseAdapter,
  UnsafeExecuteOperations,
} from '../type'
import type {
  DispatcherType,
  MigrationEvents,
  SQL,
  SQLiteAdapterOptions,
  SQLiteArg,
  SqliteDispatcher,
  SQLiteQuery,
} from './type'

import { $Shape } from '../../types'

export type { SQL, SQLiteArg, SQLiteQuery }

export default class SQLiteAdapter implements DatabaseAdapter {
  static adapterType: string

  schema: AppSchema

  migrations?: SchemaMigrations

  _migrationEvents?: MigrationEvents

  _tag: ConnectionTag

  dbName: string

  _dispatcherType: DispatcherType

  _dispatcher: SqliteDispatcher

  _initPromise: Promise<void>

  constructor(options: SQLiteAdapterOptions)

  get initializingPromise(): Promise<void>

  testClone(options?: $Shape<SQLiteAdapterOptions>): Promise<SQLiteAdapter>

  _getName(name?: string): string

  _init(callback: ResultCallback<void>): void

  _setUpWithMigrations(databaseVersion: SchemaVersion, callback: ResultCallback<void>): void

  _setUpWithSchema(callback: ResultCallback<void>): void

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void

  queryIds(query: SerializedQuery, callback: ResultCallback<RecordId[]>): void

  unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>): void

  count(query: SerializedQuery, callback: ResultCallback<number>): void

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void

  unsafeLoadFromSync(jsonId: number, callback: ResultCallback<any>): void

  provideSyncJson(id: number, syncPullResultJson: string, callback: ResultCallback<void>): void

  unsafeResetDatabase(callback: ResultCallback<void>): void

  unsafeExecute(operations: UnsafeExecuteOperations, callback: ResultCallback<void>): void

  getLocal(key: string, callback: ResultCallback<string | undefined>): void

  setLocal(key: string, value: string, callback: ResultCallback<void>): void

  removeLocal(key: string, callback: ResultCallback<void>): void

  _encodedSchema(): SQL

  _migrationSteps(fromVersion: SchemaVersion): MigrationStep[] | undefined
}
