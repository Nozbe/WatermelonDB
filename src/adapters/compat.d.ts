import type { SerializedQuery } from '../Query'
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'

import type {
  DatabaseAdapter,
  CachedFindResult,
  CachedQueryResult,
  BatchOperation,
  UnsafeExecuteOperations,
} from './type'

export default class DatabaseAdapterCompat {
  underlyingAdapter: DatabaseAdapter

  constructor(adapter: DatabaseAdapter)

  get schema(): AppSchema

  get dbName(): string | undefined

  get migrations(): SchemaMigrations | undefined

  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult>

  query(query: SerializedQuery): Promise<CachedQueryResult>

  queryIds(query: SerializedQuery): Promise<RecordId[]>

  unsafeQueryRaw(query: SerializedQuery): Promise<any[]>

  count(query: SerializedQuery): Promise<number>

  batch(operations: BatchOperation[]): Promise<void>

  getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]>

  destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void>

  unsafeLoadFromSync(jsonId: number): Promise<any>

  provideSyncJson(id: number, syncPullResultJson: string): Promise<void>

  unsafeResetDatabase(): Promise<void>

  unsafeExecute(work: UnsafeExecuteOperations): Promise<void>

  getLocal(key: string): Promise<string | undefined>

  setLocal(key: string, value: string): Promise<void>

  removeLocal(key: string): Promise<void>

  // untyped - test-only code
  testClone(options: any): Promise<any>
}
