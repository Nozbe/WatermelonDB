// @flow

import type { SerializedQuery } from '../Query'
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'
import type { RawRecord } from '../RawRecord'
import type { ResultCallback } from '../utils/fp/Result'

import type { SQLiteQuery, SQL } from './sqlite/type'
import type { Loki } from './lokijs/type'

export type CachedFindResult = RecordId | ?RawRecord
export type CachedQueryResult = Array<RecordId | RawRecord>
export type BatchOperationType = 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently'
export type BatchOperation =
  | ['create', TableName<any>, RawRecord]
  | ['update', TableName<any>, RawRecord]
  | ['markAsDeleted', TableName<any>, RecordId]
  | ['destroyPermanently', TableName<any>, RecordId]

export type UnsafeExecuteOperations =
  | $Exact<{ sqls: SQLiteQuery[] }>
  | $Exact<{ sqlString: SQL }> // JSI-only
  | $Exact<{ loki: (Loki) => void }>

export interface DatabaseAdapter {
  schema: AppSchema;

  dbName: string;

  migrations: ?SchemaMigrations; // TODO: Not optional

  // Fetches given (one) record or null. Should not send raw object if already cached in JS
  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void;

  // Fetches matching records. Should not send raw object if already cached in JS
  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void;

  // Fetches IDs of matching records
  queryIds(query: SerializedQuery, callback: ResultCallback<RecordId[]>): void;

  // Fetches unsafe, unsanitized objects according to query. You must not mutate these objects.
  unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>): void;

  // Counts matching records
  count(query: SerializedQuery, callback: ResultCallback<number>): void;

  // Executes multiple prepared operations
  batch(operations: BatchOperation[], callback: ResultCallback<void>): void;

  // Return marked as deleted records
  getDeletedRecords(tableName: TableName<any>, callback: ResultCallback<RecordId[]>): void;

  // Destroy deleted records from sync
  destroyDeletedRecords(
    tableName: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void;

  // Unsafely adds records from a serialized (json) SyncPullResult provided earlier via native API
  unsafeLoadFromSync(jsonId: number, callback: ResultCallback<any>): void;

  // Provides JSON for use by unsafeLoadFromSync
  provideSyncJson(id: number, syncPullResultJson: string, callback: ResultCallback<void>): void;

  // Destroys the whole database, its schema, indexes, everything.
  unsafeResetDatabase(callback: ResultCallback<void>): void;

  // Performs work on the underlying database - see concrete DatabaseAdapter implementation for more details
  unsafeExecute(work: UnsafeExecuteOperations, callback: ResultCallback<void>): void;

  // Fetches string value from local storage
  getLocal(key: string, callback: ResultCallback<?string>): void;

  // Sets string value to a local storage key
  setLocal(key: string, value: string, callback: ResultCallback<void>): void;

  // Removes key from local storage
  removeLocal(key: string, callback: ResultCallback<void>): void;
}
