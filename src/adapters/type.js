// @flow

import type { SerializedQuery } from '../Query'
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'
import type { RawRecord } from '../RawRecord'
import type { Result } from '../utils/fp/Result'

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
  find(table: TableName<any>, id: RecordId, callback: (Result<CachedFindResult>) => void): void;

  // Fetches matching records. Should not send raw object if already cached in JS
  query(query: SerializedQuery, callback: (Result<CachedQueryResult>) => void): void;

  // Counts matching records
  count(query: SerializedQuery, callback: (Result<number>) => void): void;

  // Executes multiple prepared operations
  batch(operations: BatchOperation[], callback: (Result<void>) => void): void;

  // Return marked as deleted records
  getDeletedRecords(tableName: TableName<any>, callback: (Result<RecordId[]>) => void): void;

  // Destroy deleted records from sync
  destroyDeletedRecords(
    tableName: TableName<any>,
    recordIds: RecordId[],
    callback: (Result<void>) => void,
  ): void;

  // Destroys the whole database, its schema, indexes, everything.
  unsafeResetDatabase(callback: (Result<void>) => void): void;

  // Fetches string value from local storage
  getLocal(key: string, callback: (Result<?string>) => void): void;

  // Sets string value to a local storage key
  setLocal(key: string, value: string, callback: (Result<void>) => void): void;

  // Removes key from local storage
  removeLocal(key: string, callback: (Result<void>) => void): void;
}

export interface SQLDatabaseAdapter {
  unsafeSqlQuery(
    tableName: TableName<any>,
    sql: string,
    callback: (Result<CachedQueryResult>) => void,
  ): void;
}
