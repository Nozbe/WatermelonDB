import { SQLiteQuery } from '@nozbe/watermelondb/adapters/sqlite'

declare module '@nozbe/watermelondb/adapters/type' {
  import { AppSchema, Model, Query, RawRecord, RecordId, TableName } from '@nozbe/watermelondb'

  export type CachedFindResult = RecordId | (RawRecord | void)
  export type CachedQueryResult = Array<RecordId | RawRecord>
  export type BatchOperation =
    | ['create', Model]
    | ['update', Model]
    | ['markAsDeleted', Model]
    | ['destroyPermanently', Model]

  export type UnsafeExecuteOperations = { sqls: SQLiteQuery[] }

  export interface DatabaseAdapter {
    schema: AppSchema

    /** Name of the database. */
    dbName?: string

    // Fetches given (one) record or null. Should not send raw object if already cached in JS
    find(table: TableName<any>, id: RecordId): Promise<CachedFindResult>

    // Fetches matching records. Should not send raw object if already cached in JS
    query<T extends Model>(query: Query<T>): Promise<CachedQueryResult>

    // Counts matching records
    count<T extends Model>(query: Query<T>): Promise<number>

    // Executes multiple prepared operations
    batch(operations: BatchOperation[]): Promise<void>

    // Return marked as deleted records
    getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]>

    // Destroy deleted records from sync
    destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void>

    // Destroys the whole database, its schema, indexes, everything.
    unsafeResetDatabase(): Promise<void>

    // Performs work on the underlying database - see concrete DatabaseAdapter implementation for more details
    unsafeExecute(work: UnsafeExecuteOperations): Promise<void>

    // Fetches string value from local storage
    getLocal(key: string): Promise<string | null>

    // Sets string value to a local storage key
    setLocal(key: string, value: string): Promise<void>

    // Removes key from local storage
    removeLocal(key: string): Promise<void>

    // Do not use — only for testing purposes
    unsafeClearCachedRecords(): Promise<void>
  }
}
