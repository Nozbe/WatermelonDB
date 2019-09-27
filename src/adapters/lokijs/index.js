// @flow

import type { LokiMemoryAdapter } from 'lokijs'
import { map } from 'rambdax'
import { invariant } from '../../utils/common'

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
} = actions

type LokiAdapterOptions = $Exact<{
  dbName?: ?string,
  schema: AppSchema,
  migrations?: SchemaMigrations,
  _testLokiAdapter?: LokiMemoryAdapter,
}>

export default class LokiJSAdapter implements DatabaseAdapter {
  workerBridge: WorkerBridge = new WorkerBridge()

  schema: AppSchema

  migrations: ?SchemaMigrations

  _dbName: ?string

  constructor(options: LokiAdapterOptions): void {
    const { schema, migrations, dbName } = options
    this.schema = schema
    this.migrations = migrations
    this._dbName = dbName

    if (process.env.NODE_ENV !== 'production') {
      invariant(
        // $FlowFixMe
        options.migrationsExperimental === undefined,
        'LokiJSAdapter migrationsExperimental has been renamed to migrations',
      )
      validateAdapter(this)
    }

    devLogSetUp(() => this.workerBridge.send(SETUP, [options]))
  }

  testClone(options?: $Shape<LokiAdapterOptions> = {}): LokiJSAdapter {
    // Ensure data is saved to memory
    // $FlowFixMe
    const { executor } = this.workerBridge._worker._worker
    executor.loki.close()

    // Copy
    const lokiAdapter = executor.loki.persistenceAdapter

    return new LokiJSAdapter({
      dbName: this._dbName,
      schema: this.schema,
      ...(this.migrations ? { migrations: this.migrations } : {}),
      _testLokiAdapter: lokiAdapter,
      ...options,
    })
  }

  find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    return devLogFind(() => this.workerBridge.send(FIND, [table, id]), table, id)
  }

  query<T: Model>(query: Query<T>): Promise<CachedQueryResult> {
    return devLogQuery(() => this.workerBridge.send(QUERY, [query.serialize()]), query)
  }

  count<T: Model>(query: Query<T>): Promise<number> {
    return devLogCount(() => this.workerBridge.send(COUNT, [query.serialize()]), query)
  }

  batch(operations: BatchOperation[]): Promise<void> {
    return devLogBatch(
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
}
