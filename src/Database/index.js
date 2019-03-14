// @flow

import type { Observable } from 'rxjs/Observable'
import { merge as merge$ } from 'rxjs/observable/merge'
import { startWith } from 'rxjs/operators'
import { values } from 'rambdax'

import { invariant } from '../utils/common'

import { CollectionChangeTypes } from '../Collection/common'

import type { DatabaseAdapter } from '../adapters/type'
import type Model from '../Model'
import type { CollectionChangeSet } from '../Collection'
import type { TableName, AppSchema } from '../Schema'

import CollectionMap from './CollectionMap'
import ActionQueue, { type ActionInterface } from './ActionQueue'

type DatabaseProps = $Exact<{
  adapter: DatabaseAdapter,
  modelClasses: Array<Class<Model>>,
  actionsEnabled?: boolean,
}>

export default class Database {
  adapter: DatabaseAdapter

  schema: AppSchema

  collections: CollectionMap

  _actionQueue = new ActionQueue()

  _actionsEnabled: boolean

  constructor({ adapter, modelClasses, actionsEnabled = false }: DatabaseProps): void {
    this.adapter = adapter
    this.schema = adapter.schema
    this.collections = new CollectionMap(this, modelClasses)
    this._actionsEnabled = actionsEnabled
  }

  // Executes multiple prepared operations
  // (made with `collection.prepareCreate` and `record.prepareUpdate`)
  async batch(...records: $ReadOnlyArray<Model>): Promise<void> {
    this._ensureInAction(
      `Database.batch() can only be called from inside of an Action. See docs for more details.`,
    )

    const operations = records.map(record => {
      invariant(
        !record._isCommitted || record._hasPendingUpdate,
        `Cannot batch a record that doesn't have a prepared create or prepared update`,
      )

      if (record._hasPendingUpdate) {
        record._hasPendingUpdate = false // TODO: What if this fails?
        return ['update', record]
      }

      return ['create', record]
    })
    await this.adapter.batch(operations)

    const sortedOperations = []
    operations.forEach(([type, record]) => {
      const operation = {
        record,
        type: type === 'create' ? CollectionChangeTypes.created : CollectionChangeTypes.updated,
      }
      const indexOfCollection = sortedOperations.findIndex(
        ({ collection }) => collection === record.collection,
      )
      if (indexOfCollection !== -1) {
        sortedOperations[indexOfCollection].operations.push(operation)
      } else {
        const { collection } = record
        sortedOperations.push({ collection, operations: [operation] })
      }
    })
    sortedOperations.forEach(({ collection, operations: operationz }) => {
      collection.changeSet(operationz)
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

  _resetCount = 0

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
    this._actionQueue._abortPendingActions()
    this._unsafeClearCaches()
    await this.adapter.unsafeResetDatabase()
    this._resetCount += 1
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
