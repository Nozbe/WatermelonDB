// @flow

import type { LokiMemoryAdapter } from 'lokijs'
import { invariant, logger } from '../../utils/common'
import type { ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { TableName, AppSchema } from '../../Schema'
import type { DirtyRaw } from '../../RawRecord'
import type { SchemaMigrations } from '../../Schema/migrations'
import type { SerializedQuery } from '../../Query'
import type { DatabaseAdapter, CachedQueryResult, CachedFindResult, BatchOperation } from '../type'
import { devSetupCallback, validateAdapter, validateTable } from '../common'

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

type LokiIDBSerializer = $Exact<{
  serializeChunk: (TableName<any>, DirtyRaw[]) => any,
  deserializeChunk: (TableName<any>, any) => DirtyRaw[],
}>

export type LokiAdapterOptions = $Exact<{
  dbName?: ?string,
  autosave?: boolean,
  schema: AppSchema,
  migrations?: SchemaMigrations,
  // (true by default) Although web workers may have some throughput benefits, disabling them
  // may lead to lower memory consumption, lower latency, and easier debugging
  useWebWorker?: boolean,
  useIncrementalIndexedDB?: boolean,
  // Called when internal IndexedDB version changed (most likely the database was deleted in another browser tab)
  // Pass a callback to force log out in this copy of the app as well
  // Note that this only works when using incrementalIDB and not using web workers
  onIndexedDBVersionChange?: () => void,
  // Called when underlying IndexedDB encountered a quota exceeded error (ran out of allotted disk space for app)
  // This means that app can't save more data or that it will fall back to using in-memory database only
  // Note that this only works when `useWebWorker: false`
  onQuotaExceededError?: (error: Error) => void,
  // Called when IndexedDB fetch has begun. Use this as an opportunity to execute code concurrently
  // while IDB does work on a separate thread.
  // Note that this only works when using incrementalIDB and not using web workers
  onIndexedDBFetchStart?: () => void,
  // Called with a chunk (array of Loki documents) before it's saved to IndexedDB/loaded from IDB. You can use it to
  // manually compress on-disk representation for faster database loads.
  // Hint: Hand-written conversion of objects to arrays is very profitable for performance.
  // Note that this only works when using incrementalIDB and not using web workers
  indexedDBSerializer?: LokiIDBSerializer,
  // -- internal --
  _testLokiAdapter?: LokiMemoryAdapter,
}>

export default class LokiJSAdapter implements DatabaseAdapter {
  workerBridge: WorkerBridge

  schema: AppSchema

  migrations: ?SchemaMigrations

  _dbName: ?string

  constructor(options: LokiAdapterOptions): void {
    const { schema, migrations, dbName } = options

    const useWebWorker = options.useWebWorker ?? process.env.NODE_ENV !== 'test'
    this.workerBridge = new WorkerBridge(useWebWorker)

    this.schema = schema
    this.migrations = migrations
    this._dbName = dbName

    if (process.env.NODE_ENV !== 'production') {
      if (!('useWebWorker' in options)) {
        logger.warn(
          'LokiJSAdapter `useWebWorker` option will become required in a future version of WatermelonDB. Pass `{ useWebWorker: false }` to adopt the new behavior, or `{ useWebWorker: true }` to supress this warning with no changes',
        )
      }
      if (!('useIncrementalIndexedDB' in options)) {
        logger.warn(
          'LokiJSAdapter `useIncrementalIndexedDB` option will become required in a future version of WatermelonDB. Pass `{ useIncrementalIndexedDB: true }` to adopt the new behavior, or `{ useIncrementalIndexedDB: false }` to supress this warning with no changes',
        )
      }
      invariant(
        !('migrationsExperimental' in options),
        'LokiJSAdapter `migrationsExperimental` option has been renamed to `migrations`',
      )
      invariant(
        !('experimentalUseIncrementalIndexedDB' in options),
        'LokiJSAdapter `experimentalUseIncrementalIndexedDB` option has been renamed to `useIncrementalIndexedDB`',
      )
      validateAdapter(this)
    }

    this.workerBridge.send(SETUP, [options], devSetupCallback, 'immutable', 'immutable')
  }

  async testClone(options?: $Shape<LokiAdapterOptions> = {}): Promise<LokiJSAdapter> {
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

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void {
    validateTable(table, this.schema)
    this.workerBridge.send(FIND, [table, id], callback, 'immutable', 'shallowCloneDeepObjects')
  }

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void {
    validateTable(query.table, this.schema)
    // SerializedQueries are immutable, so we need no copy
    this.workerBridge.send(QUERY, [query], callback, 'immutable', 'shallowCloneDeepObjects')
  }

  count(query: SerializedQuery, callback: ResultCallback<number>): void {
    validateTable(query.table, this.schema)
    // SerializedQueries are immutable, so we need no copy
    this.workerBridge.send(COUNT, [query], callback, 'immutable', 'immutable')
  }

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void {
    operations.forEach(([, table]) => validateTable(table, this.schema))
    // batches are only strings + raws which only have JSON-compatible values, rest is immutable
    this.workerBridge.send(BATCH, [operations], callback, 'shallowCloneDeepObjects', 'immutable')
  }

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void {
    validateTable(table, this.schema)
    this.workerBridge.send(GET_DELETED_RECORDS, [table], callback, 'immutable', 'immutable')
  }

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void {
    validateTable(table, this.schema)
    this.workerBridge.send(
      DESTROY_DELETED_RECORDS,
      [table, recordIds],
      callback,
      'immutable',
      'immutable',
    )
  }

  unsafeResetDatabase(callback: ResultCallback<void>): void {
    this.workerBridge.send(UNSAFE_RESET_DATABASE, [], callback, 'immutable', 'immutable')
  }

  getLocal(key: string, callback: ResultCallback<?string>): void {
    this.workerBridge.send(GET_LOCAL, [key], callback, 'immutable', 'immutable')
  }

  setLocal(key: string, value: string, callback: ResultCallback<void>): void {
    this.workerBridge.send(SET_LOCAL, [key, value], callback, 'immutable', 'immutable')
  }

  removeLocal(key: string, callback: ResultCallback<void>): void {
    this.workerBridge.send(REMOVE_LOCAL, [key], callback, 'immutable', 'immutable')
  }

  // Executes multiple prepared operations
  batchImport(_operations: BatchOperation[], _srcDB: any, _callback: ResultCallback<void>): void {
    throw new Error('batchImport not implemented in LOKIJS')
  }

  syncCache(_table: any, _removedIds): void {
    throw new Error('syncCache not implemented in LOKIJS')
  }
}
