import type Model from '../../Model'
import type { RecordId } from '../../Model'
import type Query from '../../Query'
import type { AppSchema, TableName } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'
import type { BatchOperation, CachedFindResult, CachedQueryResult, DatabaseAdapter } from '../type'

export type SQL = string

export type SQLiteArg = string | boolean | number | null

export type SQLiteQuery = [SQL, SQLiteArg[]]

export type MigrationEvents = {
  onSuccess: () => void
  onStart: () => void
  onError: (error: Error) => void
}

export interface SQLiteAdapterOptions {
  dbName?: string
  migrations?: SchemaMigrations
  schema: AppSchema
  jsi?: boolean
  migrationEvents?: MigrationEvents
  onSetUpError?: (error: Error) => void
  usesExclusiveLocking?: boolean
}

export default interface SQLiteAdapter extends DatabaseAdapter {
  schema: AppSchema

  constructor(options: SQLiteAdapterOptions)

  batch(operations: BatchOperation[]): Promise<void>

  count<T extends Model>(query: Query<T>): Promise<number>

  destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void>

  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult>

  getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]>

  getLocal(key: string): Promise<string | null>

  query<T extends Model>(query: Query<T>): Promise<CachedQueryResult>

  removeLocal(key: string): Promise<void>

  setLocal(key: string, value: string): Promise<void>

  unsafeClearCachedRecords(): Promise<void>

  unsafeResetDatabase(): Promise<void>
}
