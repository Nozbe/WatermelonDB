// @flow

import { type Observable, BehaviorSubject } from '../utils/rx'
import { type Unsubscribe } from '../utils/subscriptions'
import logger from '../utils/common/logger'
import invariant from '../utils/common/invariant'
import ensureSync from '../utils/common/ensureSync'
import fromPairs from '../utils/fp/fromPairs'
import noop from '../utils/fp/noop'
import type { $RE } from '../types'

import type Database from '../Database'
import type Collection from '../Collection'
import type CollectionMap from '../Database/CollectionMap'
import { type TableName, type ColumnName, columnName } from '../Schema'
import type { Value } from '../QueryDescription'
import { type RawRecord, type DirtyRaw, sanitizedRaw, setRawSanitized } from '../RawRecord'
import { setRawColumnChange } from '../sync/helpers'

import { createTimestampsFor, fetchDescendants } from './helpers'

export type RecordId = string

/**
 * Sync status of this record:
 *
 * - `synced` - up to date as of last sync
 * - `created` - locally created, not yet pushed
 * - `updated` - locally updated, not yet pushed
 * - `deleted` - locally marked as deleted, not yet pushed
 * - `disposable` - read-only, memory-only, not part of sync, MUST NOT appear in a persisted record
 */
export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted' | 'disposable'

export type BelongsToAssociation = $RE<{ type: 'belongs_to', key: ColumnName }>
export type HasManyAssociation = $RE<{ type: 'has_many', foreignKey: ColumnName }>
export type AssociationInfo = BelongsToAssociation | HasManyAssociation
export type Associations = { +[TableName<any>]: AssociationInfo }

// TODO: Refactor associations API and ideally get rid of this in favor of plain arrays/objects
export function associations(
  ...associationList: [TableName<any>, AssociationInfo][]
): Associations {
  return (fromPairs(associationList): any)
}

export default class Model {
  /**
   * This must be set in Model subclasses to the name of associated database table
   */
  static +table: TableName<this>

  /**
   * This can be set in Model subclasses to define (parent/child) relationships between different
   * Models.
   *
   * See docs for more details.
   */
  static associations: Associations = {}

  // Used by withObservables to differentiate between object types
  static _wmelonTag: string = 'model'

  _raw: RawRecord

  _isEditing: boolean = false

  _preparedState: null | 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently' = null

  __changes: ?BehaviorSubject<$FlowFixMe<this>> = null

  _getChanges(): BehaviorSubject<$FlowFixMe<this>> {
    if (!this.__changes) {
      // initializing lazily - it has non-trivial perf impact on very large collections
      this.__changes = new BehaviorSubject(this)
    }
    return this.__changes
  }

  /**
   * Record's ID
   */
  get id(): RecordId {
    return this._raw.id
  }

  /**
   * Record's sync status
   *
   * @see SyncStatus
   */
  get syncStatus(): SyncStatus {
    return this._raw._status
  }

  /**
   * Modifies the record.
   * Pass a function to set attributes of the new record.
   *
   * Updates `updateAt` field (if available)
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   *
   * * @example
   * ```js
   * someTask.create(task => {
   *   task.name = 'New name'
   * })
   */
  async update(recordUpdater: (this) => void = noop): Promise<this> {
    this.__ensureInWriter(`Model.update()`)
    const record = this.prepareUpdate(recordUpdater)
    await this.db.batch(this)
    return record
  }

  /**
   * Prepares record to be updated
   *
   * Use this to batch-execute multiple changes at once.
   * Note: Prepared changes must be executed by **synchronously** passing them to `database.batch()`
   * @see {Model#update}
   * @see {Database#batch}
   */
  prepareUpdate(recordUpdater: (this) => void = noop): this {
    invariant(
      !this._preparedState,
      `Cannot update a record with pending changes (${this.__debugName})`,
    )
    this.__ensureNotDisposable(`Model.prepareUpdate()`)
    this._isEditing = true

    // Touch updatedAt (if available)
    if ('updatedAt' in this) {
      this._setRaw(columnName('updated_at'), Date.now())
    }

    // Perform updates
    ensureSync(recordUpdater(this))
    this._isEditing = false
    this._preparedState = 'update'

    // TODO: `process.nextTick` doesn't work on React Native
    // We could polyfill with setImmediate, but it doesn't have the same effect — test and enseure
    // it would actually work for this purpose
    // TODO: Also add to other prepared changes
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof process !== 'undefined' &&
      process &&
      process.nextTick
    ) {
      process.nextTick(() => {
        invariant(
          this._preparedState !== 'update',
          `record.prepareUpdate was called on ${this.__debugName} but wasn't sent to batch() synchronously -- this is bad!`,
        )
      })
    }
    this.__logVerbose('prepareUpdate')

    return this
  }

  /**
   * Marks this record as deleted (it will be deleted permanently after sync)
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   */
  async markAsDeleted(): Promise<void> {
    this.__ensureInWriter(`Model.markAsDeleted()`)
    this.__ensureNotDisposable(`Model.markAsDeleted()`)
    await this.db.batch(this.prepareMarkAsDeleted())
  }

  /**
   * Prepares record to be marked as deleted
   *
   * Use this to batch-execute multiple changes at once.
   * Note: Prepared changes must be executed by **synchronously** passing them to `database.batch()`
   * @see {Model#markAsDeleted}
   * @see {Database#batch}
   */
  prepareMarkAsDeleted(): this {
    invariant(
      !this._preparedState,
      `Cannot mark a record with pending changes as deleted (${this.__debugName})`,
    )
    this.__ensureNotDisposable(`Model.prepareMarkAsDeleted()`)
    this._raw._status = 'deleted'
    this._preparedState = 'markAsDeleted'
    this.__logVerbose('prepareMarkAsDeleted')
    return this
  }

  /**
   * Permanently deletes this record from the database
   *
   * Note: Do not use this when using Sync, as deletion will not be synced.
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   */
  async destroyPermanently(): Promise<void> {
    this.__ensureInWriter(`Model.destroyPermanently()`)
    this.__ensureNotDisposable(`Model.destroyPermanently()`)
    await this.db.batch(this.prepareDestroyPermanently())
  }

  /**
   * Prepares record to be permanently destroyed
   *
   * Note: Do not use this when using Sync, as deletion will not be synced.
   *
   * Use this to batch-execute multiple changes at once.
   * Note: Prepared changes must be executed by **synchronously** passing them to `database.batch()`
   * @see {Model#destroyPermanently}
   * @see {Database#batch}
   */
  prepareDestroyPermanently(): this {
    invariant(
      !this._preparedState,
      `Cannot destroy permanently record with pending changes (${this.__debugName})`,
    )
    this.__ensureNotDisposable(`Model.prepareDestroyPermanently()`)
    this._raw._status = 'deleted'
    this._preparedState = 'destroyPermanently'
    this.__logVerbose('prepareDestroyPermanently')
    return this
  }

  /**
   * Marks this records and its descendants as deleted (they will be deleted permenently after sync)
   *
   * Descendants are determined by taking Model's `has_many` (children) associations, and then their
   * children associations recursively.
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   */
  async experimentalMarkAsDeleted(): Promise<void> {
    this.__ensureInWriter(`Model.experimentalMarkAsDeleted()`)
    this.__ensureNotDisposable(`Model.experimentalMarkAsDeleted()`)
    const records = await fetchDescendants(this)
    records.forEach((model) => model.prepareMarkAsDeleted())
    records.push(this.prepareMarkAsDeleted())
    await this.db.batch(records)
  }

  /**
   * Permanently deletes this record and its descendants from the database
   *
   * Descendants are determined by taking Model's `has_many` (children) associations, and then their
   * children associations recursively.
   *
   * Note: Do not use this when using Sync, as deletion will not be synced.
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   */
  async experimentalDestroyPermanently(): Promise<void> {
    this.__ensureInWriter(`Model.experimentalDestroyPermanently()`)
    this.__ensureNotDisposable(`Model.experimentalDestroyPermanently()`)
    const records = await fetchDescendants(this)
    records.forEach((model) => model.prepareDestroyPermanently())
    records.push(this.prepareDestroyPermanently())
    await this.db.batch(records)
  }

  // *** Observing changes ***

  /**
   * Returns an `Rx.Observable` that emits a signal immediately upon subscription and then every time
   * this record changes.
   *
   * Signals contain this record as its value for convenience.
   *
   * Emits `complete` signal if this record is deleted (marked as deleted or permanently destroyed)
   */
  observe(): Observable<this> {
    invariant(
      this._preparedState !== 'create',
      `Cannot observe uncommitted record (${this.__debugName})`,
    )
    return this._getChanges()
  }

  /**
   * Collection associated with this Model
   */
  +collection: Collection<$FlowFixMe<this>>

  // TODO: Deprecate
  /**
   * Collections of other Models in the same database as this record.
   *
   * @deprecated
   */
  get collections(): CollectionMap {
    return this.database.collections
  }

  // TODO: Deprecate
  get database(): Database {
    return this.collection.database
  }

  /**
   * `Database` this record is associated with
   */
  get db(): Database {
    return this.collection.database
  }

  get asModel(): this {
    return this
  }

  /**
   * Table name of this record
   */
  get table(): TableName<this> {
    return this.constructor.table
  }

  // TODO: protect batch,callWriter,... from being used outside a @reader/@writer
  /**
   * Convenience method that should ONLY be used by Model's `@writer`-decorated methods
   *
   * @see {Database#batch}
   */
  batch(...records: $ReadOnlyArray<Model | null | void | false>): Promise<void> {
    return this.db.batch((records: any))
  }

  /**
   * Convenience method that should ONLY be used by Model's `@writer`-decorated methods
   *
   * @see {WriterInterface#callWriter}
   */
  callWriter<T>(action: () => Promise<T>): Promise<T> {
    return this.db._workQueue.subAction(action)
  }

  /**
   * Convenience method that should ONLY be used by Model's `@writer`/`@reader`-decorated methods
   *
   * @see {ReaderInterface#callReader}
   */
  callReader<T>(action: () => Promise<T>): Promise<T> {
    return this.db._workQueue.subAction(action)
  }

  // *** Implementation details ***

  // Don't use this directly! Use `collection.create()`
  constructor(collection: Collection<this>, raw: RawRecord): void {
    this.collection = collection
    this._raw = raw
  }

  static _prepareCreate(
    collection: Collection<$FlowFixMe<this>>,
    recordBuilder: (this) => void,
  ): this {
    const record = new this(
      collection,
      // sanitizedRaw sets id
      sanitizedRaw(createTimestampsFor(this.prototype), collection.schema),
    )

    record._preparedState = 'create'
    record._isEditing = true
    ensureSync(recordBuilder(record))
    record._isEditing = false

    record.__logVerbose('prepareCreate')

    return record
  }

  static _prepareCreateFromDirtyRaw(
    collection: Collection<$FlowFixMe<this>>,
    dirtyRaw: DirtyRaw,
  ): this {
    const record = new this(collection, sanitizedRaw(dirtyRaw, collection.schema))
    record._preparedState = 'create'
    record.__logVerbose('prepareCreateFromDirtyRaw')
    return record
  }

  static _disposableFromDirtyRaw(
    collection: Collection<$FlowFixMe<this>>,
    dirtyRaw: DirtyRaw,
  ): this {
    const record = new this(collection, sanitizedRaw(dirtyRaw, collection.schema))
    record._raw._status = 'disposable'
    record.__logVerbose('disposableFromDirtyRaw')
    return record
  }

  _subscribers: [(isDeleted: boolean) => void, any][] = []

  /**
   * Notifies `subscriber` on every change (update/delete) of this record
   *
   * Notification contains a flag that indicates whether the change is due to deletion
   * (Currently, subscribers are called after `changes` emissions, but this behavior might change)
   */
  experimentalSubscribe(subscriber: (isDeleted: boolean) => void, debugInfo?: any): Unsubscribe {
    const entry = [subscriber, debugInfo]
    this._subscribers.push(entry)

    return () => {
      const idx = this._subscribers.indexOf(entry)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  _notifyChanged(): void {
    this._getChanges().next(this)
    this._subscribers.forEach(([subscriber]) => {
      subscriber(false)
    })
  }

  _notifyDestroyed(): void {
    this._getChanges().complete()
    this._subscribers.forEach(([subscriber]) => {
      subscriber(true)
    })
  }

  // TODO: Make this official API
  _getRaw(rawFieldName: ColumnName): Value {
    return this._raw[(rawFieldName: string)]
  }

  // TODO: Make this official API
  _setRaw(rawFieldName: ColumnName, rawValue: Value): void {
    this.__ensureCanSetRaw()
    const valueBefore = this._raw[(rawFieldName: string)]
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])

    if (valueBefore !== this._raw[(rawFieldName: string)] && this._preparedState !== 'create') {
      setRawColumnChange(this._raw, rawFieldName)
    }
  }

  // Please don't use this unless you really understand how Watermelon Sync works, and thought long and
  // hard about risks of inconsistency after sync
  // TODO: Make this official API
  _dangerouslySetRawWithoutMarkingColumnChange(rawFieldName: ColumnName, rawValue: Value): void {
    this.__ensureCanSetRaw()
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])
  }

  get __debugName(): string {
    return `${this.table}#${this.id}`
  }

  __ensureCanSetRaw(): void {
    this.__ensureNotDisposable(`Model._setRaw()`)
    invariant(
      this._isEditing,
      `Not allowed to change record ${this.__debugName} outside of create/update()`,
    )
    invariant(
      !(this._getChanges(): $FlowFixMe<BehaviorSubject<any>>).isStopped &&
        this._raw._status !== 'deleted',
      `Not allowed to change deleted record ${this.__debugName}`,
    )
  }

  __ensureNotDisposable(debugName: string): void {
    invariant(
      this._raw._status !== 'disposable',
      `${debugName} cannot be called on a disposable record ${this.__debugName}`,
    )
  }

  __ensureInWriter(debugName: string): void {
    this.db._ensureInWriter(`${debugName} (${this.__debugName})`)
  }

  __logVerbose(debugName: string): void {
    if (this.db.experimentalIsVerbose) {
      logger.debug(`${debugName}: ${this.__debugName}`)
    }
  }
}
