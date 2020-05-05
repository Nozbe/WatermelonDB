// @flow

import type { Observable } from 'rxjs/Observable'
import { merge as merge$ } from 'rxjs/observable/merge'
import { startWith } from 'rxjs/operators'
import { values } from 'rambdax'

import { type Unsubscribe } from '../utils/subscriptions'
import { invariant, logger } from '../utils/common'
import { noop } from '../utils/fp'

import type { DatabaseAdapter, BatchOperation } from '../adapters/type'
import DatabaseAdapterCompat from '../adapters/compat'
import type Model from '../Model'
import { type CollectionChangeSet } from '../Collection'
import { CollectionChangeTypes } from '../Collection/common'
import type { TableName, AppSchema } from '../Schema'

import CollectionMap from './CollectionMap'
import ActionQueue, { type ActionInterface } from './ActionQueue'

type DatabaseProps = $Exact<{
  adapter: DatabaseAdapter,
  modelClasses: Array<Class<Model>>,
  actionsEnabled: boolean,
}>

export default class Database {
  adapter: DatabaseAdapterCompat

  schema: AppSchema

  collections: CollectionMap

  _actionQueue = new ActionQueue()

  _actionsEnabled: boolean

  constructor({ adapter, modelClasses, actionsEnabled }: DatabaseProps): void {
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

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  // Note: falsy values (null, undefined, false) passed to batch are just ignored
  async batch(...records: $ReadOnlyArray<Model | null | void | false>): Promise<void> {
    this._ensureInAction(
      `Database.batch() can only be called from inside of an Action. See docs for more details.`,
    )

    // performance critical - using mutations
    const batchOperations: BatchOperation[] = []
    const changeNotifications: { [collectionName: TableName<any>]: CollectionChangeSet<*> } = {}
    records.forEach(record => {
      if (!record) {
        return
      }

      invariant(
        !record._isCommitted || record._hasPendingUpdate || record._hasPendingDelete,
        `Cannot batch a record that doesn't have a prepared create or prepared update`,
      )

      const raw = record._raw
      const { id } = raw // faster than Model.id
      const { table } = record.constructor // faster than Model.table

      let changeType

      // Deletes take presedence over updates
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

    await this.adapter.batch(batchOperations)

    // NOTE: We must make two passes to ensure all changes to caches are applied before subscribers are called
    Object.entries(changeNotifications).forEach(notification => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification: any)
      this.collections.get(table)._applyChangesToCache(changeSet)
    })

    Object.entries(changeNotifications).forEach(notification => {
      const [table, changeSet]: [TableName<any>, CollectionChangeSet<any>] = (notification: any)
      this.collections.get(table)._notify(changeSet)
    })

    const affectedTables = Object.keys(changeNotifications)
    this._subscribers.forEach(([tables, subscriber]) => {
      if (tables.some(table => affectedTables.includes(table))) {
        subscriber()
      }
    })
  }

  // Enqueues an Action -- a block of code that, when its ran, has a guarantee that no other Action
  // is running at the same time.
  // If Database is instantiated with actions enabled, all write actions (create, update, delete)
  // must be performed inside Actions, so Actions guarantee a write lock.
  //
  // See docs for more details and practical guide
  action<T>(work: ActionInterface => Promise<T>, description?: string): Promise<T> {
    return this._actionQueue.enqueue(work, description)
  }

  // Emits a signal immediately, and on change in any of the passed tables
  withChangesForTables(tables: TableName<any>[]): Observable<CollectionChangeSet<any> | null> {
    const changesSignals = tables.map(table => this.collections.get(table).changes)

    return merge$(...changesSignals).pipe(startWith(null))
  }

  _subscribers: Array<[TableName<any>[], () => void]> = []

  // Notifies `subscriber` on change in any of passed tables (only a signal, no change set)
  experimentalSubscribe(tables: TableName<any>[], subscriber: () => void): Unsubscribe {
    if (!tables.length) {
      return noop
    }

    const subscriberEntry = [tables, subscriber]
    this._subscribers.push(subscriberEntry)

    return () => {
      const idx = this._subscribers.indexOf(subscriberEntry)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  _resetCount: number = 0

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
    // First kill actions, to ensure no more traffic to adapter happens
    this._actionQueue._abortPendingActions()

    // Kill ability to call adapter methods during reset (to catch bugs if someone does this)
    const { adapter } = this
    const ErrorAdapter = require('../adapters/error').default
    this.adapter = (new ErrorAdapter(): any)

    // Check for illegal subscribers
    if (this._subscribers.length) {
      // eslint-disable-next-line no-console
      console.error(
        'Application error! 1 Database subscriber was detected during database.unsafeResetDatabase() call. App should not hold onto subscriptions or Watermelon objects while resetting database.',
      )
      this._subscribers = []
    }

    // Clear the database
    await adapter.unsafeResetDatabase()

    // Only now clear caches, since there may have been queued fetches from DB still bringing in items to cache
    this._unsafeClearCaches()

    // Restore working Database
    this._resetCount += 1
    this.adapter = adapter
  }

  _unsafeClearCaches(): void {
    values(this.collections.map).forEach(collection => {
      collection.unsafeClearCache()
    })
  }

  _ensureInAction(error: string): void {
    this._actionsEnabled && invariant(this._actionQueue.isRunning, error)
  }
}
