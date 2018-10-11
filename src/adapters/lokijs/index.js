// @flow

import { map } from 'rambdax'
import { isDevelopment } from '../../utils/common'

import type Model, { RecordId } from '../../Model'
import type { TableName, AppSchema } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'
import type Query from '../../Query'
import type { DatabaseAdapter, CachedQueryResult, CachedFindResult, BatchOperation } from '../type'
import {
  devLogFind,
  devLogQuery,
  devLogCount,
  devLogBatch,
  devLogSetUp,
  validateAdapter,
} from '../common'

import WorkerBridge from './WorkerBridge'
import { actions } from './common'

const {
  SETUP,
  FIND,
  QUERY,
  COUNT,
  BATCH,
  UNSAFE_RESET_DATABASE,
  GET_LOCAL,
  SET_LOCAL,
  REMOVE_LOCAL,
  GET_DELETED_RECORDS,
  DESTROY_DELETED_RECORDS,
  UNSAFE_CLEAR_CACHED_RECORDS,
} = actions

type LokiAdapterOptions = $Exact<{
  dbName: string,
  schema: AppSchema,
  migrationsExperimental?: SchemaMigrations,
}>

export default class LokiJSAdapter implements DatabaseAdapter {
  workerBridge: WorkerBridge = new WorkerBridge()

  schema: AppSchema

  migrations: ?SchemaMigrations

  constructor(options: LokiAdapterOptions): void {
    const { schema, migrationsExperimental: migrations } = options
    this.schema = schema
    this.migrations = migrations
    isDevelopment && validateAdapter(this)

    devLogSetUp(() => this.workerBridge.send(SETUP, [options]))
  }

  async find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    return devLogFind(() => this.workerBridge.send(FIND, [table, id]), table, id)
  }

  async query<T: Model>(query: Query<T>): Promise<CachedQueryResult> {
    return devLogQuery(() => this.workerBridge.send(QUERY, [query.serialize()]), query)
  }

  async count<T: Model>(query: Query<T>): Promise<number> {
    return devLogCount(() => this.workerBridge.send(COUNT, [query.serialize()]), query)
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    await devLogBatch(
      () =>
        this.workerBridge.send(BATCH, [
          map(([type, record]) => [type, record.table, record._raw], operations),
        ]),
      operations,
    )
  }

  getDeletedRecords(tableName: TableName<any>): Promise<RecordId[]> {
    return this.workerBridge.send(GET_DELETED_RECORDS, [tableName])
  }

  destroyDeletedRecords(tableName: TableName<any>, recordIds: RecordId[]): Promise<void> {
    return this.workerBridge.send(DESTROY_DELETED_RECORDS, [tableName, recordIds])
  }

  unsafeResetDatabase(): Promise<void> {
    return this.workerBridge.send(UNSAFE_RESET_DATABASE)
  }

  getLocal(key: string): Promise<string> {
    return this.workerBridge.send(GET_LOCAL, [key])
  }

  setLocal(key: string, value: string): Promise<void> {
    return this.workerBridge.send(SET_LOCAL, [key, value])
  }

  removeLocal(key: string): Promise<void> {
    return this.workerBridge.send(REMOVE_LOCAL, [key])
  }

  async unsafeClearCachedRecords(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      await this.workerBridge.send(UNSAFE_CLEAR_CACHED_RECORDS, [])
    }
  }
}
