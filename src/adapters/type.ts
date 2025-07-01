import type {SerializedQuery} from '../Query';
import type { TableName, AppSchema } from '../Schema'
import type { SchemaMigrations } from '../Schema/migrations'
import type { RecordId } from '../Model'
import type { RawRecord } from '../RawRecord'
import type { ResultCallback } from '../utils/fp/Result'
import type { ConnectionTag } from '../utils/common'

export type CachedFindResult = RecordId | RawRecord | null | undefined;
export type CachedQueryResult = Array<RecordId | RawRecord>;
export type BatchOperationType = 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently';
export type BatchOperation = ['create', TableName<any>, RawRecord] | ['update', TableName<any>, RawRecord] | ['markAsDeleted', TableName<any>, RecordId] | ['destroyPermanently', TableName<any>, RecordId];

export interface DatabaseAdapter {
  schema: AppSchema;
  migrations: SchemaMigrations | null | undefined // TODO: Not optional;
  // Fetches given (one) record or null. Should not send raw object if already cached in JS
  find(
    table: TableName<any>,
    id: RecordId,
    callback: ResultCallback<CachedFindResult>,
  ): void;
  // Fetches matching records. Should not send raw object if already cached in JS
  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void;
  // Counts matching records
  count(query: SerializedQuery, callback: ResultCallback<number>): void;
  // Executes multiple prepared operations
  batch(operations: BatchOperation[], callback: ResultCallback<undefined>): void;
  // Return marked as deleted records
  getDeletedRecords(tableName: TableName<any>, callback: ResultCallback<RecordId[]>): void;
  // Destroy deleted records from sync
  destroyDeletedRecords(
    tableName: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<undefined>,
  ): void;
  // Destroys the whole database, its schema, indexes, everything.
  unsafeResetDatabase(callback: ResultCallback<undefined>): void;
  // Fetches string value from local storage
  getLocal(key: string, callback: ResultCallback<string | null | undefined>): void;
  // Sets string value to a local storage key
  setLocal(key: string, value: string, callback: ResultCallback<undefined>): void;
  // Removes key from local storage
  removeLocal(key: string, callback: ResultCallback<undefined>): void;
  // Executes multiple prepared operations
  batchImport(
    operations: BatchOperation[],
    srcDB: any,
    callback: ResultCallback<undefined>,
  ): void;
  execSqlQuery(
    sql: string,
    params: any[],
    callback: ResultCallback<{
      [key: string]: any;
    }[]>,
  ): void;
  obliterateDatabase(callback: ResultCallback<undefined>): void;
  enableNativeCDC(callback: ResultCallback<undefined>): void;
  _hybridJSIEnabled?: boolean;
  _tag?: ConnectionTag;
  testClone(options: any): Promise<any>;
}

export interface SQLDatabaseAdapter {
  unsafeSqlQuery(
    tableName: TableName<any>,
    sql: string,
    callback: ResultCallback<CachedQueryResult>,
  ): void;
}
