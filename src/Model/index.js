// @flow

import { type Observable, BehaviorSubject } from '../utils/rx'
import { type Unsubscribe } from '../utils/subscriptions'
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

import { createTimestampsFor, fetchChildren } from './helpers'

export type RecordId = string

export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted'

export type BelongsToAssociation = $RE<{ type: 'belongs_to', key: ColumnName }>
export type HasManyAssociation = $RE<{ type: 'has_many', foreignKey: ColumnName }>
export type AssociationInfo = BelongsToAssociation | HasManyAssociation
export type Associations = { +[TableName<any>]: AssociationInfo }

export function associations(
  ...associationList: [TableName<any>, AssociationInfo][]
): Associations {
  return (fromPairs(associationList): any)
}

export default class Model {
  // Set this in concrete Models to the name of the database table
  static +table: TableName<this>

  // Set this in concrete Models to define relationships between different records
  static associations: Associations = {}

  // Used by withObservables to differentiate between object types
  static _wmelonTag = 'model'

  _raw: RawRecord

  _isEditing: boolean = false

  // `false` when instantiated but not yet in the database
  _isCommitted: boolean = true

  // `true` when prepareUpdate was called, but not yet sent to be executed
  // turns to `false` the moment the update is sent to be executed, even if database
  // did not respond yet
  _hasPendingUpdate: boolean = false

  _hasPendingDelete: false | 'mark' | 'destroy' = false

  __changes: ?BehaviorSubject<$FlowFixMe<this>> = null

  _getChanges(): BehaviorSubject<$FlowFixMe<this>> {
    if (!this.__changes) {
      // initializing lazily - it has non-trivial perf impact on very large collections
      this.__changes = new BehaviorSubject(this)
    }
    return this.__changes
  }

  get id(): RecordId {
    return this._raw.id
  }

  get syncStatus(): SyncStatus {
    return this._raw._status
  }

  // Modifies the model (using passed function) and saves it to the database.
  // Touches `updatedAt` if available.
  //
  // Example:
  // someTask.update(task => {
  //   task.name = 'New name'
  // })
  async update(recordUpdater: this => void = noop): Promise<this> {
    this.collection.database._ensureInAction(
      `Model.update() can only be called from inside of an Action. See docs for more details.`,
    )
    const record = this.prepareUpdate(recordUpdater)
    await this.collection.database.batch(this)
    return record
  }

  // Prepares an update to the database (using passed function).
  // Touches `updatedAt` if available.
  //
  // After preparing an update, you must execute it synchronously using
  // database.batch()
  prepareUpdate(recordUpdater: this => void = noop): this {
    invariant(this._isCommitted, `Cannot update uncommitted record`)
    invariant(!this._hasPendingUpdate, `Cannot update a record with pending updates`)

    this._isEditing = true

    // Touch updatedAt (if available)
    if ('updatedAt' in this) {
      this._setRaw(columnName('updated_at'), Date.now())
    }

    // Perform updates
    ensureSync(recordUpdater(this))
    this._isEditing = false
    this._hasPendingUpdate = true

    // TODO: `process.nextTick` doesn't work on React Native
    // We could polyfill with setImmediate, but it doesn't have the same effect — test and enseure
    // it would actually work for this purpose
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof process !== 'undefined' &&
      process &&
      process.nextTick
    ) {
      process.nextTick(() => {
        invariant(
          !this._hasPendingUpdate,
          `record.prepareUpdate was called on ${this.table}#${
            this.id
          } but wasn't sent to batch() synchronously -- this is bad!`,
        )
      })
    }

    return this
  }

  prepareMarkAsDeleted(): this {
    invariant(this._isCommitted, `Cannot mark an uncomitted record as deleted`)
    invariant(!this._hasPendingUpdate, `Cannot mark an updated record as deleted`)

    this._isEditing = true
    this._raw._status = 'deleted'
    this._hasPendingDelete = 'mark'
    this._isEditing = false

    return this
  }

  prepareDestroyPermanently(): this {
    invariant(this._isCommitted, `Cannot mark an uncomitted record as deleted`)
    invariant(!this._hasPendingUpdate, `Cannot mark an updated record as deleted`)

    this._isEditing = true
    this._raw._status = 'deleted'
    this._hasPendingDelete = 'destroy'
    this._isEditing = false

    return this
  }

  // Marks this record as deleted (will be permanently deleted after sync)
  // Note: Use this only with Sync
  async markAsDeleted(): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.markAsDeleted() can only be called from inside of an Action. See docs for more details.`,
    )
    await this.collection.database.batch(this.prepareMarkAsDeleted())
  }

  // Pernamently removes this record from the database
  // Note: Don't use this when using Sync
  async destroyPermanently(): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.destroyPermanently() can only be called from inside of an Action. See docs for more details.`,
    )
    await this.collection.database.batch(this.prepareDestroyPermanently())
  }

  async experimentalMarkAsDeleted(): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.experimental_markAsDeleted() can only be called from inside of an Action. See docs for more details.`,
    )
    const children = await fetchChildren(this)
    children.forEach(model => model.prepareMarkAsDeleted())
    await this.collection.database.batch(...children, this.prepareMarkAsDeleted())
  }

  async experimentalDestroyPermanently(): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.experimental_destroyPermanently() can only be called from inside of an Action. See docs for more details.`,
    )
    const children = await fetchChildren(this)
    children.forEach(model => model.prepareDestroyPermanently())
    await this.collection.database.batch(...children, this.prepareDestroyPermanently())
  }

  // *** Observing changes ***

  // Returns an observable that emits `this` upon subscription and every time this record changes
  // Emits `complete` if this record is destroyed
  observe(): Observable<this> {
    invariant(this._isCommitted, `Cannot observe uncommitted record`)
    return this._getChanges()
  }

  // *** Implementation details ***

  +collection: Collection<$FlowFixMe<this>>

  // Collections of other Models in the same domain as this record
  get collections(): CollectionMap {
    return this.database.collections
  }

  get database(): Database {
    return this.collection.database
  }

  get db(): Database {
    return this.collection.database
  }

  get asModel(): this {
    return this
  }

  // See: Database.batch()
  // To be used by Model subclass methods only
  batch(...records: $ReadOnlyArray<Model | null | void | false>): Promise<void> {
    return this.collection.database.batch(...records)
  }

  // TODO: Document me
  // To be used by Model subclass methods only
  subAction<T>(action: () => Promise<T>): Promise<T> {
    return this.collection.database._actionQueue.subAction(action)
  }

  get table(): TableName<this> {
    return this.constructor.table
  }

  // Don't use this directly! Use `collection.create()`
  constructor(collection: Collection<this>, raw: RawRecord): void {
    this.collection = collection
    this._raw = raw
  }

  static _prepareCreate(
    collection: Collection<$FlowFixMe<this>>,
    recordBuilder: this => void,
  ): this {
    const record = new this(
      collection,
      // sanitizedRaw sets id
      sanitizedRaw(createTimestampsFor(this.prototype), collection.schema),
    )

    record._isCommitted = false
    record._isEditing = true
    ensureSync(recordBuilder(record))
    record._isEditing = false

    return record
  }

  static _prepareCreateFromDirtyRaw(
    collection: Collection<$FlowFixMe<this>>,
    dirtyRaw: DirtyRaw,
  ): this {
    const record = new this(collection, sanitizedRaw(dirtyRaw, collection.schema))
    record._isCommitted = false
    return record
  }

  _subscribers: [(isDeleted: boolean) => void, any][] = []

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

  _getRaw(rawFieldName: ColumnName): Value {
    return this._raw[(rawFieldName: string)]
  }

  _setRaw(rawFieldName: ColumnName, rawValue: Value): void {
    invariant(this._isEditing, 'Not allowed to change record outside of create/update()')
    invariant(
      !(this._getChanges(): $FlowFixMe<BehaviorSubject<any>>).isStopped &&
        this._raw._status !== 'deleted',
      'Not allowed to change deleted records',
    )

    const valueBefore = this._raw[(rawFieldName: string)]
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])

    if (valueBefore !== this._raw[(rawFieldName: string)]) {
      setRawColumnChange(this._raw, rawFieldName)
    }
  }

  // Please don't use this unless you really understand how Watermelon Sync works, and thought long and
  // hard about risks of inconsistency after sync
  _dangerouslySetRawWithoutMarkingColumnChange(rawFieldName: ColumnName, rawValue: Value): void {
    invariant(this._isEditing, 'Not allowed to change record outside of create/update()')
    invariant(
      !(this._getChanges(): $FlowFixMe<BehaviorSubject<any>>).isStopped &&
        this._raw._status !== 'deleted',
      'Not allowed to change deleted records',
    )

    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])
  }
}
