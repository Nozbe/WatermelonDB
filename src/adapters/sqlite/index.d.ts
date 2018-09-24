declare module "@nozbe/watermelondb/adapters/sqlite" {
  import {
    AppSchema, DatabaseAdapter, Model,
    Query, RecordId, TableName,
  } from "@nozbe/watermelondb";
  import {
    BatchOperation, CachedFindResult, CachedQueryResult,
  } from "@nozbe/watermelondb/adapters/type";

  export type SQL = string;

  export type SQLiteArg = string | boolean | number | null;

  export type SQLiteQuery = [SQL, SQLiteArg[]];

  export interface SQLiteAdapterOptions {
    dbName: string,
    schema: AppSchema,
  }

  export default class SQLiteAdapter implements DatabaseAdapter {
    schema: AppSchema;

    constructor(options: SQLiteAdapterOptions);

    batch(operations: BatchOperation[]): Promise<void>;

    count<T extends Model>(query: Query<T>): Promise<number>;

    destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void>;

    find(table: TableName<any>, id: RecordId): Promise<CachedFindResult>;

    getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]>;

    getLocal(key: string): Promise<string | void>;

    query<T extends Model>(query: Query<T>): Promise<CachedQueryResult>;

    removeLocal(key: string): Promise<void>;

    setLocal(key: string, value: string): Promise<void>;

    unsafeClearCachedRecords(): Promise<void>;

    unsafeResetDatabase(): Promise<void>;
  }
}