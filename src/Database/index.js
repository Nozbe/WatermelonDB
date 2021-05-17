// @flow

import { type Observable, startWith, merge as merge$ } from '../utils/rx'
import { type Unsubscribe } from '../utils/subscriptions'
import { invariant, logger, deprecated } from '../utils/common'
import { noop } from '../utils/fp'

import type { DatabaseAdapter, BatchOperation } from '../adapters/type'
import DatabaseAdapterCompat from '../adapters/compat'
import type Model from '../Model'
import type Collection, { CollectionChangeSet } from '../Collection'
import { CollectionChangeTypes } from '../Collection/common'
import type { TableName, AppSchema } from '../Schema'

import CollectionMap from './CollectionMap'
import WorkQueue, { type ReaderInterface, type WriterInterface } from './WorkQueue'

type DatabaseProps = $Exact<{
  adapter: DatabaseAdapter,
  modelClasses: Array<Class<Model>>,
}>

let experimentalAllowsFatalError = false

export function setExperimentalAllowsFatalError(): void {
  experimentalAllowsFatalError = true
}

export default class Database {
  adapter: DatabaseAdapterCompat

  schema: AppSchema

  collections: CollectionMap

  _workQueue: WorkQueue = new WorkQueue(this)

  // (experimental) if true, Database is in a broken state and should not be used anymore
  _isBroken: boolean = false

  constructor(options: DatabaseProps): void {
    const { adapter, modelClasses } = options
    if (process.env.NODE_ENV !== 'production') {
      invariant(adapter, `Missing adapter parameter for new Database()`)
      invariant(
        modelClasses && Array.isArray(modelClasses),
        `Missing modelClasses parameter for new Database()`,
      )
      // $FlowFixMe
      options.actionsEnabled === false &&
        invariant(false, 'new Database({ actionsEnabled: false }) is no longer supported')
      options.actionsEnabled === true &&
        logger.warn(
          'new Database({ actionsEnabled: true }) option is unnecessary (actions are always enabled)',
        )
    }
    this.adapter = new DatabaseAdapterCompat(adapter)
    this.schema = adapter.schema
    this.collections = new CollectionMap(this, modelClasses)
  }

  get<T: Model>(tableName: TableName<T>): Collection<T> {
    return this.collections.get(tableName)
  }

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  // Note: falsy values (null, undefined, false) passed to batch are just ignored
  async batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void> {
    if (!Array.isArray(records[0])) {
      // $FlowFixMe
      return this.batch(records)
    }
    invariant(
      records.length === 1,
      'batch should be called with a list of models or a single array',
    )
    const actualRecords = records[0]

    this._ensureInWriter(`Database.batch()`)

    // performance critical - using mutations
    const batchOperations: BatchOperation[] = []
    const changeNotifications: { [collectionName: TableName<any>]: CollectionChangeSet<*> } = {}
    actualRecords.forEach((record) => {
      if (!record) {
        return
      }

      const preparedState = record._preparedState
      invariant(
        preparedState,
        `Cannot batch a record that doesn't have a prepared create/update/delete`,
      )

      const raw = record._raw
      const { id } = raw // faster than Model.id
      const { table } = record.constructor // faster than Model.table

      let changeType

      if (preparedState === 'update') {
        batchOperations.push(['update', table, raw])
        changeType = CollectionChangeTypes.updated
      } else if (preparedState === 'create') {
        batchOperations.push(['create', table, raw])
        changeType = CollectionChangeTypes.created
      } else if (preparedState === 'markAsDeleted') {
        batchOperations.push(['markAsDeleted', table, id])
        changeType = CollectionChangeTypes.destroyed
      } else if (preparedState === 'destroyPermanently') {
        batchOperations.push(['destroyPermanently', table, id])
        changeType = CollectionChangeTypes.destroyed
      } else {
        invariant(false, 'bad preparedState')
      }

      if (preparedState !== 'create') {
        // We're (unsafely) assuming that batch will succeed and removing the "pending" state so that
        // subsequent changes to the record don't trip up the invariant
        // TODO: What if this fails?
        record._preparedState = null
      }

      if (!changeNotifications[table]) {
        changeNotifications[table] = []
      }
      changeNotifications[table].push({ record, type: changeType })
    })

    await this.adapter.batch(batchOperations)

    // NOTE: We must make two passes to ensure all changes to caches are applied before subscribers are called
    Object.entries(changeNotifications).forEach((notification) => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification: any)
      this.collections.get(table)._applyChangesToCache(changeSet)
    })

    Object.entries(changeNotifications).forEach((notification) => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification: any)
      this.collections.get(table)._notify(changeSet)
    })

    const affectedTables = Object.keys(changeNotifications)
    const databaseChangeNotifySubscribers = ([tables, subscriber]): void => {
      if (tables.some((table) => affectedTables.includes(table))) {
        subscriber()
      }
    }
    this._subscribers.forEach(databaseChangeNotifySubscribers)
    return undefined // shuts up flow
  }

  // Enqueues a Writer - a block of code that, when it's running, has a guarantee that no other Writer
  // is running at the same time.
  // All actions that modify the database (create, update, delete) must be performed inside of a Writer block
  // See docs for more details and practical guide
  write<T>(work: (WriterInterface) => Promise<T>, description?: string): Promise<T> {
    return this._workQueue.enqueue(work, description, true)
  }

  // Enqueues a Reader - a block of code that, when it's running, has a guarantee that no Writer
  // is running at the same time (therefore, the database won't be modified for the duration of Reader's work)
  // See docs for more details and practical guide
  read<T>(work: (ReaderInterface) => Promise<T>, description?: string): Promise<T> {
    return this._workQueue.enqueue(work, description, false)
  }

  action<T>(work: (WriterInterface) => Promise<T>, description?: string): Promise<T> {
    deprecated('Database.action()', 'Use Database.write() instead.')
    return this._workQueue.enqueue(work, `${description || 'unnamed'} (legacy action)`, true)
  }

  // Emits a signal immediately, and on change in any of the passed tables
  withChangesForTables(tables: TableName<any>[]): Observable<CollectionChangeSet<any> | null> {
    const changesSignals = tables.map((table) => this.collections.get(table).changes)

    return merge$(...changesSignals).pipe(startWith(null))
  }

  _subscribers: [TableName<any>[], () => void, any][] = []

  // Notifies `subscriber` on change in any of passed tables (only a signal, no change set)
  experimentalSubscribe(
    tables: TableName<any>[],
    subscriber: () => void,
    debugInfo?: any,
  ): Unsubscribe {
    if (!tables.length) {
      return noop
    }

    const entry = [tables, subscriber, debugInfo]
    this._subscribers.push(entry)

    return () => {
      const idx = this._subscribers.indexOf(entry)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  _resetCount: number = 0

  _isBeingReset: boolean = false

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
  async unsafeResetDatabase(): Promise<void> {
    this._ensureInWriter(`Database.unsafeResetDatabase()`)
    try {
      this._isBeingReset = true
      // First kill actions, to ensure no more traffic to adapter happens
      this._workQueue._abortPendingWork()

      // Kill ability to call adapter methods during reset (to catch bugs if someone does this)
      const { adapter } = this
      const ErrorAdapter = require('../adapters/error').default
      this.adapter = (new ErrorAdapter(): any)

      // Check for illegal subscribers
      if (this._subscribers.length) {
        // TODO: This should be an error, not a console.log, but actually useful diagnostics are necessary for this to work, otherwise people will be confused
        // eslint-disable-next-line no-console
        console.log(
          `Application error! Unexpected ${this._subscribers.length} Database subscribers were detected during database.unsafeResetDatabase() call. App should not hold onto subscriptions or Watermelon objects while resetting database.`,
        )
        // eslint-disable-next-line no-console
        console.log(this._subscribers)
        this._subscribers = []
      }

      // Clear the database
      await adapter.unsafeResetDatabase()

      // Only now clear caches, since there may have been queued fetches from DB still bringing in items to cache
      this._unsafeClearCaches()

      // Restore working Database
      this._resetCount += 1
      this.adapter = adapter
    } finally {
      this._isBeingReset = false
    }
  }

  _unsafeClearCaches(): void {
    Object.values(this.collections.map).forEach((collection) => {
      // $FlowFixMe
      collection._cache.unsafeClear()
    })
  }

  _ensureInWriter(diagnosticMethodName: string): void {
    invariant(
      this._workQueue.isWriterRunning,
      `${diagnosticMethodName} can only be called from inside of a Writer. See docs for more details.`,
    )
  }

  // (experimental) puts Database in a broken state
  // TODO: Not used anywhere yet
  _fatalError(error: Error): void {
    if (!experimentalAllowsFatalError) {
      logger.warn(
        'Database is now broken, but experimentalAllowsFatalError has not been enabled to do anything about it...',
      )
      return
    }

    this._isBroken = true
    logger.error('Database is broken. App must be reloaded before continuing.')

    // TODO: Passing this to an adapter feels wrong, but it's tricky.
    // $FlowFixMe
    if (this.adapter.underlyingAdapter._fatalError) {
      // $FlowFixMe
      this.adapter.underlyingAdapter._fatalError(error)
    }
  }
}
