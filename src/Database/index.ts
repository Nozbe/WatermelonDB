import {values} from 'rambdax';

import { Observable, startWith, merge as merge$ } from '../utils/rx'
import { Unsubscribe } from '../utils/subscriptions'
import { invariant } from '../utils/common'
import { noop } from '../utils/fp'

import type { DatabaseAdapter, BatchOperation } from '../adapters/type'
import DatabaseAdapterCompat from '../adapters/compat'
import type Model from '../Model'
import type Collection from '../Collection'
import type { CollectionChangeSet } from '../Collection'
import { CollectionChangeTypes } from '../Collection/common'
import type { TableName, AppSchema } from '../Schema'

import CollectionMap from './CollectionMap'
import ActionQueue, { ActionInterface } from './ActionQueue'

type DatabaseProps = {
  adapter: DatabaseAdapter;
  modelClasses: Array<typeof Model>;
  actionsEnabled: boolean;
};

export default class Database {
  adapter: DatabaseAdapterCompat;

  schema: AppSchema;

  collections: CollectionMap;

  _actionQueue = new ActionQueue()

  _actionsEnabled: boolean;

  constructor(
    {
      adapter,
      modelClasses,
      actionsEnabled,
    }: DatabaseProps,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      invariant(adapter, `Missing adapter parameter for new Database()`)
      invariant(
        modelClasses && Array.isArray(modelClasses),
        `Missing modelClasses parameter for new Database()`,
      )
      invariant(
        actionsEnabled === true || actionsEnabled === false,
        'You must pass `actionsEnabled:` key to Database constructor. It is highly recommended you pass `actionsEnabled: true` (see documentation for more details), but can pass `actionsEnabled: false` for backwards compatibility.',
      )
    }
    this.adapter = new DatabaseAdapterCompat(adapter)
    this.schema = adapter.schema
    this.collections = new CollectionMap(this, modelClasses)
    this._actionsEnabled = actionsEnabled
  }

  get<T extends Model>(tableName: TableName<T>): Collection<T> {
    return this.collections.get(tableName)
  }

  copyTables = async (tables: any, srcDB: any) => {
    return this.adapter.batchImport(tables, srcDB)
  }

  enableNativeCDC = async () => {
    return this.adapter.enableNativeCDC()
  }

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  // Note: falsy values (null, undefined, false) passed to batch are just ignored
  async batch(...records: Array<Model | null | undefined | false | Model[]>): Promise<void> {
    // If we're passed multiple arguments, wrap them in an array
    if (records.length > 1) {
      return this.batch(records as any);
    }

    // If we're passed a single array argument, use it directly
    const actualRecords = Array.isArray(records[0]) ? records[0] : records

    this._ensureInAction(
      `Database.batch() can only be called from inside of an Action. See docs for more details.`,
    )

    // performance critical - using mutations
    const batchOperations: BatchOperation[] = []
    const changeNotifications: Partial<Record<TableName<any>, CollectionChangeSet<any>>> = {};
    const chunkSize = 10000 // Set the chunk size to 10,000

    // Split actualRecords into chunks
    const chunks: Array<any | Array<Model | false | null | undefined>> = []
    for (let i = 0; i < actualRecords.length; i += chunkSize) {
      chunks.push(actualRecords.slice(i, i + chunkSize))
    }

    for (const chunk of chunks) {
      chunk.forEach((record: any) => {
        if (!record) {
          return
        }

        const raw = record._raw
        const { id } = raw // faster than Model.id
        const { table } = record.constructor // faster than Model.table

        let changeType

        // Deletes take precedence over updates
        if (record._hasPendingDelete) {
          if (record._hasPendingDelete === 'destroy') {
            batchOperations.push(['destroyPermanently', table, id])
          } else {
            batchOperations.push(['markAsDeleted', table, id])
          }
          changeType = CollectionChangeTypes.destroyed
        } else if (record._hasPendingUpdate) {
          record._hasPendingUpdate = false // TODO: What if this fails?
          batchOperations.push(['update', table, raw])
          changeType = CollectionChangeTypes.updated
        } else {
          batchOperations.push(['create', table, raw])
          changeType = CollectionChangeTypes.created
        }

        if (!changeNotifications[table]) {
          changeNotifications[table] = []
        }
        changeNotifications[table].push({ record, type: changeType })
      })

      // Make a copy of operations to prevent mutation and clear for next chunk
      const operations = [...batchOperations]
      await this.adapter.batch(operations)
      batchOperations.length = 0
    }

    // NOTE: We must make two passes to ensure all changes to caches are applied before subscribers are called
    Object.entries(changeNotifications).forEach(notification => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification as any)
      this.collections.get(table)._applyChangesToCache(changeSet)
    })

    Object.entries(changeNotifications).forEach(notification => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification as any)
      this.collections.get(table)._notify(changeSet)
    })

    const affectedTables = Object.keys(changeNotifications)
    const databaseChangeNotifySubscribers = ([tables, subscriber]: [any, any]): void => {
      if (tables.some((table: any) => affectedTables.includes(table))) {
        subscriber()
      }
    }
    // @ts-ignore
    this._subscribers.forEach(databaseChangeNotifySubscribers)
    return undefined // shuts up flow
  }

  // Enqueues an Action -- a block of code that, when its ran, has a guarantee that no other Action
  // is running at the same time.
  // If Database is instantiated with actions enabled, all write actions (create, update, delete)
  // must be performed inside Actions, so Actions guarantee a write lock.
  //
  // See docs for more details and practical guide
  action<T>(work: (arg1: ActionInterface) => Promise<T>, description?: string): Promise<T> {
    return this._actionQueue.enqueue(work, description)
  }

  /* EXPERIMENTAL API - DO NOT USE */
  _write<T>(work: (arg1: ActionInterface) => Promise<T>, description?: string): Promise<T> {
    return this._actionQueue.enqueue(work, description)
  }

  _read<T>(work: (arg1: ActionInterface) => Promise<T>, description?: string): Promise<T> {
    return this._actionQueue.enqueue(work, description)
  }

  _together<T>(work: (arg1: ActionInterface) => Promise<T>, description?: string): Promise<T> {
    return this._actionQueue.enqueue(work, description)
  }

  // Emits a signal immediately, and on change in any of the passed tables
  withChangesForTables(tables: TableName<any>[]): Observable<CollectionChangeSet<any> | null> {
    const changesSignals = tables.map(table => this.collections.get(table).changes)

    return merge$(...changesSignals).pipe(startWith(null))
  }

  _subscribers: [TableName<any>[], () => void, any][] = [];

  // Notifies `subscriber` on change in any of passed tables (only a signal, no change set)
  experimentalSubscribe(tables: TableName<any>[], subscriber: () => void, debugInfo?: any): Unsubscribe {
    if (!tables.length) {
      return noop
    }

    const entry = [tables, subscriber, debugInfo]
    this._subscribers.push(entry as any)

    return () => {
      const idx = this._subscribers.indexOf(entry as any)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  _resetCount: number = 0;

  _isBeingReset: boolean = false;

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
    this._ensureInAction(
      `Database.unsafeResetDatabase() can only be called from inside of an Action. See docs for more details.`,
    )
    try {
      this._isBeingReset = true
      // First kill actions, to ensure no more traffic to adapter happens
      this._actionQueue._abortPendingActions()

      // Kill ability to call adapter methods during reset (to catch bugs if someone does this)
      const { adapter } = this
      const ErrorAdapter = require('../adapters/error').default
      this.adapter = (new ErrorAdapter() as any)

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
    values(this.collections.map).forEach((collection: any) => {
      collection.unsafeClearCache()
    })
  }

  _ensureInAction(error: string): void {
    this._actionsEnabled && invariant(this._actionQueue.isRunning, error)
  }
}
