// @flow

import type { SerializedQuery } from '../Query'
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'
import type { RawRecord } from '../RawRecord'

export type CachedFindResult = RecordId | ?RawRecord
export type CachedQueryResult = Array<RecordId | RawRecord>
export type BatchOperationType = 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently'
export type BatchOperation =
  | ['create', TableName<any>, RawRecord]
  | ['update', TableName<any>, RawRecord]
  | ['markAsDeleted', TableName<any>, RecordId]
  | ['destroyPermanently', TableName<any>, RecordId]

export interface DatabaseAdapter {
  schema: AppSchema;

  migrations: ?SchemaMigrations; // TODO: Not optional

  // Fetches given (one) record or null. Should not send raw object if already cached in JS
  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult>;

  // Fetches matching records. Should not send raw object if already cached in JS
  query(query: SerializedQuery): Promise<CachedQueryResult>;

  // Counts matching records
  count(query: SerializedQuery): Promise<number>;

  // Executes multiple prepared operations
  batch(operations: BatchOperation[]): Promise<void>;

  // Return marked as deleted records
  getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]>;

  // Destroy deleted records from sync
  destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void>;

  // Destroys the whole database, its schema, indexes, everything.
  unsafeResetDatabase(): Promise<void>;

  // Fetches string value from local storage
  getLocal(key: string): Promise<?string>;

  // Sets string value to a local storage key
  setLocal(key: string, value: string): Promise<void>;

  // Removes key from local storage
  removeLocal(key: string): Promise<void>;
}

export interface SQLDatabaseAdapter {
  unsafeSqlQuery(tableName: TableName<any>, sql: string): Promise<CachedQueryResult>;
}
