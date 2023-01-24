import type { Observable } from '../utils/rx'
import { Unsubscribe } from '../utils/subscriptions'

import type { DatabaseAdapter } from '../adapters/type'
import DatabaseAdapterCompat from '../adapters/compat'
import type Model from '../Model'
import type Collection from '../Collection'
import type { CollectionChangeSet } from '../Collection'
import type { TableName, AppSchema } from '../Schema'

import CollectionMap from './CollectionMap'
import type LocalStorage from './LocalStorage'
import WorkQueue from './WorkQueue'
import type { ReaderInterface, WriterInterface } from './WorkQueue'

import { $ReadOnlyArray, $Exact, Class } from '../types'

type DatabaseProps = $Exact<{
  adapter: DatabaseAdapter
  modelClasses:  Class<Model>[]
}>

export function setExperimentalAllowsFatalError(): void

export default class Database {
  adapter: DatabaseAdapterCompat

  schema: AppSchema

  collections: CollectionMap

  _workQueue: WorkQueue

  // (experimental) if true, Database is in a broken state and should not be used anymore
  _isBroken: boolean

  _localStorage: LocalStorage

  constructor(options: DatabaseProps)

  get<T extends Model>(tableName: TableName<T>): Collection<T>

  get localStorage(): LocalStorage

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  // Note: falsy values (null, undefined, false) passed to batch are just ignored
  batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void>

  // Enqueues a Writer - a block of code that, when it's running, has a guarantee that no other Writer
  // is running at the same time.
  // All actions that modify the database (create, update, delete) must be performed inside of a Writer block
  // See docs for more details and practical guide
  write<T>(work: (writer: WriterInterface) => Promise<T>, description?: string): Promise<T>

  // Enqueues a Reader - a block of code that, when it's running, has a guarantee that no Writer
  // is running at the same time (therefore, the database won't be modified for the duration of Reader's work)
  // See docs for more details and practical guide
  read<T>(work: (reader: ReaderInterface) => Promise<T>, description?: string): Promise<T>

  action<T>(work: (writer: WriterInterface) => Promise<T>, description?: string): Promise<T>

  // Emits a signal immediately, and on change in any of the passed tables
  withChangesForTables(tables: TableName<any>[]): Observable<CollectionChangeSet<any> | null>

  _subscribers: [TableName<any>[], () => void, any][]

  // Notifies `subscriber` on change in any of passed tables (only a signal, no change set)
  experimentalSubscribe(
    tables: TableName<any>[],
    subscriber: () => void,
    debugInfo?: any,
  ): Unsubscribe

  _resetCount: number

  _isBeingReset: boolean

  // Resets database - permanently destroys ALL records stored in the database, and sets up empty database
  //
  // NOTE: This is not 100% safe automatically and you must take some precautions to avoid bugs:
  // - You must NOT hold onto any Database objects. DO NOT store or cache any records, collections, anything
  // - You must NOT observe any record or collection or query
  // - You SHOULD NOT have any pending (queued) Actions. Pending actions will be aborted (will reject with an error).
  //
  // It's best to reset your app to an empty / logged out state before doing this.
  //
  // Yes, this sucks and there should be some safety mechanisms or warnings. Please contribute!
  unsafeResetDatabase(): Promise<void>

  _ensureInWriter(diagnosticMethodName: string): void

  // (experimental) puts Database in a broken state
  // TODO: Not used anywhere yet
  _fatalError(error: Error): void
}
