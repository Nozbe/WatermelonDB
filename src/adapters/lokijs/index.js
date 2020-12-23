// @flow

// don't import the whole utils/ here!
import type { LokiMemoryAdapter } from 'lokijs'
import invariant from '../../utils/common/invariant'
import logger from '../../utils/common/logger'
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
  EXPERIMENTAL_FATAL_ERROR,
  CLEAR_CACHED_RECORDS,
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
  // Called when database failed to set up (initialize) correctly. It's possible that
  // it's some transient IndexedDB error that will be solved by a reload, but it's
  // very likely that the error is persistent (e.g. a corrupted database).
  // Pass a callback to offer to the user to reload the app or log out
  onSetUpError?: (error: Error) => void,
  // Called when internal IndexedDB version changed (most likely the database was deleted in another browser tab)
  // Pass a callback to force log out in this copy of the app as well
  // (Due to a race condition, it's usually best to just reload the web app)
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
  // extra options passed to Loki constructor
  extraLokiOptions?: { autosave?: boolean, autosaveInterval?: number, ... },
  // extra options passed to IncrementalIDBAdapter constructor
  extraIncrementalIDBOptions?: {
    // Called when this adapter is forced to overwrite contents of IndexedDB.
    // This happens if there's another open tab of the same app that's making changes.
    // You might use it as an opportunity to alert user to the potential loss of data
    onDidOverwrite?: () => void,
    ...,
  },
  // -- internal --
  _testLokiAdapter?: LokiMemoryAdapter,
  _onFatalError?: (error: Error) => void, // (experimental)
  _concurrentIdb?: boolean, // (experimental)
}>

export default class LokiJSAdapter implements DatabaseAdapter {
  workerBridge: WorkerBridge

  schema: AppSchema

  migrations: ?SchemaMigrations

  _dbName: ?string

  _options: LokiAdapterOptions

  constructor(options: LokiAdapterOptions): void {
    this._options = options
    const { schema, migrations, dbName } = options

    const useWebWorker = options.useWebWorker ?? process.env.NODE_ENV !== 'test'
    this.workerBridge = new WorkerBridge(useWebWorker)

    this.schema = schema
    this.migrations = migrations
    this._dbName = dbName

    if (process.env.NODE_ENV !== 'production') {
      invariant(!('password' in options),
          'LokiJSAdapter `password` option not supported. Encryption is only supported on mobile.',
        )
      invariant('useWebWorker' in options,
          'LokiJSAdapter `useWebWorker` option is required. Pass `{ useWebWorker: false }` to adopt the new behavior, or `{ useWebWorker: true }` to supress this warning with no changes',
        )
      invariant('useIncrementalIndexedDB' in options,
          'LokiJSAdapter `useIncrementalIndexedDB` option is required. Pass `{ useIncrementalIndexedDB: true }` to adopt the new behavior, or `{ useIncrementalIndexedDB: false }` to supress this warning with no changes',
        )
      // TODO(2021-05): Remove this
      invariant(
        !('migrationsExperimental' in options),
        'LokiJSAdapter `migrationsExperimental` option has been renamed to `migrations`',
      )
      // TODO(2021-05): Remove this
      invariant(
        !('experimentalUseIncrementalIndexedDB' in options),
        'LokiJSAdapter `experimentalUseIncrementalIndexedDB` option has been renamed to `useIncrementalIndexedDB`',
      )
      validateAdapter(this)
    }
    const callback = result => devSetupCallback(result, options.onSetUpError)
    this.workerBridge.send(SETUP, [options], callback, 'immutable', 'immutable')
  }

  async testClone(options?: $Shape<LokiAdapterOptions> = {}): Promise<LokiJSAdapter> {
    // Ensure data is saved to memory
    // $FlowFixMe
    const { executor } = this.workerBridge._worker._worker
    executor.loki.close()

    // Copy
    const lokiAdapter = executor.loki.persistenceAdapter

    return new LokiJSAdapter({
      ...this._options,
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

  // dev/debug utility
  get _executor(): any {
    // $FlowFixMe
    return this.workerBridge._worker._worker.executor
  }

  // (experimental)
  _fatalError(error: Error): void {
    this.workerBridge.send(EXPERIMENTAL_FATAL_ERROR, [error], () => {}, 'immutable', 'immutable')
  }

  // (experimental)
  _clearCachedRecords(): void {
    this.workerBridge.send(CLEAR_CACHED_RECORDS, [], () => {}, 'immutable', 'immutable')
  }

  _debugDignoseMissingRecord(table: TableName<any>, id: RecordId): void {
    const lokiExecutor = this._executor
    if (lokiExecutor) {
      const lokiCollection = lokiExecutor.loki.getCollection(table)
      // if we can find the record by ID, it just means that the record cache ID was corrupted
      const didFindById = !!lokiCollection.by('id', id)
      logger.log(`Did find ${table}#${id} in Loki collection by ID? ${didFindById}`)

      // if we can't, but can filter to it, it means that Loki indices are corrupted
      const didFindByFilter = !!lokiCollection.data.filter(doc => doc.id === id)
      logger.log(`Did find ${table}#${id} in Loki collection by filtering the collection? ${didFindByFilter}`)
    }
  }
}
