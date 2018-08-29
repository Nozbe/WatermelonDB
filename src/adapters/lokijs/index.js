// @flow

import { map } from 'rambdax'
import { devMeasureTimeAsync, logger } from 'utils/common'

import type Model, { RecordId } from 'Model'
import type { TableName, AppSchema } from 'Schema'
import type Query from 'Query'
import type {
  DatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
} from 'adapters/type'

import WorkerBridge from './WorkerBridge'
import { actions, type LokiAdapterOptions } from './common'

const {
  SETUP,
  FIND,
  QUERY,
  COUNT,
  CREATE,
  BATCH,
  UPDATE,
  DESTROY_PERMANENTLY,
  UNSAFE_RESET_DATABASE,
  GET_LOCAL,
  SET_LOCAL,
  REMOVE_LOCAL,
  MARK_AS_DELETED,
  GET_DELETED_RECORDS,
  DESTROY_DELETED_RECORDS,
  UNSAFE_CLEAR_CACHED_RECORDS,
} = actions

export default class LokiJSAdapter implements DatabaseAdapter {
  workerBridge: WorkerBridge = new WorkerBridge()

  schema: AppSchema

  constructor(options: LokiAdapterOptions): void {
    this._setUp(options)
    this.schema = options.schema
  }

  async _setUp(options: LokiAdapterOptions): Promise<void> {
    try {
      const [, time] = await devMeasureTimeAsync(() => this.workerBridge.send(SETUP, [options]))
      logger.log(`[DB] All set up in ${time}ms`)
    } catch (error) {
      logger.error(`[DB] Uh-oh. Database failed to load, we're in big trouble`, error)
    }
  }

  async find(table: TableName<any>, id: RecordId): Promise<CachedFindResult> {
    const [data, time] = await devMeasureTimeAsync(() => this.workerBridge.send(FIND, [table, id]))
    logger.log(`[DB] Found ${table}#${id} in ${time}ms`)
    return data
  }

  async query<T: Model>(query: Query<T>): Promise<CachedQueryResult> {
    const [data, time] = await devMeasureTimeAsync(() =>
      this.workerBridge.send(QUERY, [query.serialize()]),
    )

    logger.log(`[DB] Loaded ${data.length} ${query.table} in ${time}ms`)
    return data
  }

  async count<T: Model>(query: Query<T>): Promise<number> {
    const [count, time] = await devMeasureTimeAsync(() =>
      this.workerBridge.send(COUNT, [query.serialize()]),
    )

    logger.log(`[DB] Counted ${count} ${query.table} in ${time}ms`)
    return count
  }

  async create(record: Model): Promise<void> {
    const [, time] = await devMeasureTimeAsync(() =>
      this.workerBridge.send(CREATE, [record.table, record._raw]),
    )

    logger.log(`[DB] Inserted ${record.table}#${record.id} in ${time}ms`)
  }

  async update(record: Model): Promise<void> {
    const [, time] = await devMeasureTimeAsync(() =>
      this.workerBridge.send(UPDATE, [record.table, record._raw]),
    )

    logger.log(`[DB] Updated ${record.table}#${record.id} in ${time}ms`)
  }

  destroyPermanently(record: Model): Promise<void> {
    return this.workerBridge.send(DESTROY_PERMANENTLY, [record.table, record.id])
  }

  markAsDeleted(record: Model): Promise<void> {
    return this.workerBridge.send(MARK_AS_DELETED, [record.table, record.id])
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    if (!operations.length) {
      return
    }

    const [, time] = await devMeasureTimeAsync(() =>
      this.workerBridge.send(BATCH, [
        map(([type, record]) => [type, record.table, record._raw], operations),
      ]),
    )

    const [type, { table }] = operations[0]
    logger.log(
      `[DB] Executed batch of ${
        operations.length
      } operations (first: ${type} on ${table}) in ${time}ms`,
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
