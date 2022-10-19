import type { LokiMemoryAdapter } from './type'
import type { ResultCallback } from '../../utils/fp/Result'

import type { RecordId } from '../../Model'
import type { TableName, AppSchema } from '../../Schema'
import type { DirtyRaw } from '../../RawRecord'
import type { SchemaMigrations } from '../../Schema/migrations'
import type { SerializedQuery } from '../../Query'
import type {
  DatabaseAdapter,
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
  UnsafeExecuteOperations,
} from '../type'

import LokiDispatcher from './dispatcher'

import { $Exact, $Shape } from '../../types'

export type LokiAdapterOptions = $Exact<{
  dbName?: string
  schema: AppSchema
  migrations?: SchemaMigrations
  // (true by default) Although web workers may have some throughput benefits, disabling them
  // may lead to lower memory consumption, lower latency, and easier debugging
  useWebWorker?: boolean
  useIncrementalIndexedDB?: boolean
  // Called when database failed to set up (initialize) correctly. It's possible that
  // it's some transient IndexedDB error that will be solved by a reload, but it's
  // very likely that the error is persistent (e.g. a corrupted database).
  // Pass a callback to offer to the user to reload the app or log out
  onSetUpError?: (error: Error) => void
  // Called when underlying IndexedDB encountered a quota exceeded error (ran out of allotted disk space for app)
  // This means that app can't save more data or that it will fall back to using in-memory database only
  // Note that this only works when `useWebWorker: false`
  onQuotaExceededError?: (error: Error) => void
  // extra options passed to Loki constructor
  extraLokiOptions?: $Exact<{
    autosave?: boolean
    autosaveInterval?: number
  }>
  // extra options passed to IncrementalIDBAdapter constructor
  extraIncrementalIDBOptions?: $Exact<{
    // Called when this adapter is forced to overwrite contents of IndexedDB.
    // This happens if there's another open tab of the same app that's making changes.
    // You might use it as an opportunity to alert user to the potential loss of data
    onDidOverwrite?: () => void
    // Called when internal IndexedDB version changed (most likely the database was deleted in another browser tab)
    // Pass a callback to force log out in this copy of the app as well
    // (Due to a race condition, it's usually best to just reload the web app)
    // Note that this only works when not using web workers
    onversionchange?: () => void
    // Called with a chunk (array of Loki documents) before it's saved to IndexedDB/loaded from IDB. You can use it to
    // manually compress on-disk representation for faster database loads.
    // Hint: Hand-written conversion of objects to arrays is very profitable for performance.
    // Note that this only works when not using web workers
    serializeChunk?: (table: TableName<any>, chunk: DirtyRaw[]) => any
    deserializeChunk?: (table: TableName<any>, chunk: any) => DirtyRaw[]
    // Called when IndexedDB fetch has begun. Use this as an opportunity to execute code concurrently
    // while IDB does work on a separate thread.
    // Note that this only works when not using web workers
    onFetchStart?: () => void
    // Collections (by table name) that Loki should deserialize lazily. This is only profitable for
    // collections that are most likely not required for launch - making everything lazy makes it slower
    lazyCollections?: TableName<any>[]
  }>
  // -- internal --
  _testLokiAdapter?: LokiMemoryAdapter
  _onFatalError?: (error: Error) => void // (experimental)
  _betaLoki?: boolean // (experimental)
}>

export default class LokiJSAdapter implements DatabaseAdapter {
  static adapterType: string

  _dispatcher: LokiDispatcher

  schema: AppSchema

  dbName: string

  migrations?: SchemaMigrations

  _options: LokiAdapterOptions

  constructor(options: LokiAdapterOptions)

  testClone(options?: $Shape<LokiAdapterOptions>): Promise<LokiJSAdapter>

  find(table: TableName<any>, id: RecordId, callback: ResultCallback<CachedFindResult>): void

  query(query: SerializedQuery, callback: ResultCallback<CachedQueryResult>): void

  queryIds(query: SerializedQuery, callback: ResultCallback<RecordId[]>): void

  unsafeQueryRaw(query: SerializedQuery, callback: ResultCallback<any[]>): void

  count(query: SerializedQuery, callback: ResultCallback<number>): void

  batch(operations: BatchOperation[], callback: ResultCallback<void>): void

  getDeletedRecords(table: TableName<any>, callback: ResultCallback<RecordId[]>): void

  destroyDeletedRecords(
    table: TableName<any>,
    recordIds: RecordId[],
    callback: ResultCallback<void>,
  ): void

  unsafeLoadFromSync(jsonId: number, callback: ResultCallback<any>): void

  provideSyncJson(id: number, syncPullResultJson: string, callback: ResultCallback<void>): void

  unsafeResetDatabase(callback: ResultCallback<void>): void

  unsafeExecute(operations: UnsafeExecuteOperations, callback: ResultCallback<void>): void

  getLocal(key: string, callback: ResultCallback<string | undefined>): void

  setLocal(key: string, value: string, callback: ResultCallback<void>): void

  removeLocal(key: string, callback: ResultCallback<void>): void

  // dev/debug utility
  get _driver(): any

  // (experimental)
  _fatalError(error: Error): void

  // (experimental)
  _clearCachedRecords(): void

  _debugDignoseMissingRecord(table: TableName<any>, id: RecordId): void
}
