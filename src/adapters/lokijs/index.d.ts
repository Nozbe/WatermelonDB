declare module '@nozbe/watermelondb/adapters/lokijs' {
  import { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
  import { LokiMemoryAdapter } from 'lokijs';

  import {
    AppSchema,
    DatabaseAdapter,
    Model,
    Query,
    RecordId,
    TableName,
  } from '@nozbe/watermelondb'
  import {
    BatchOperation,
    CachedFindResult,
    CachedQueryResult,
  } from '@nozbe/watermelondb/adapters/type'

  export interface LokiAdapterOptions {
    dbName?: string
    autosave?: boolean
    schema: AppSchema
    migrations?: SchemaMigrations
    useWebWorker?: boolean
    useIncrementalIndexedDB?: boolean
    _testLokiAdapter?: LokiMemoryAdapter
  }

  export default class LokiJSAdapter implements DatabaseAdapter {
    schema: AppSchema

    constructor(options: LokiAdapterOptions)

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
}
