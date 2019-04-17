// @flow

import type { Observable } from 'rxjs'
import { BehaviorSubject } from 'rxjs/BehaviorSubject'
import isDevelopment from '../utils/common/isDevelopment'
import invariant from '../utils/common/invariant'
import ensureSync from '../utils/common/ensureSync'
import fromPairs from '../utils/fp/fromPairs'
import noop from '../utils/fp/noop'
import type { $RE } from '../types'

import field from '../decorators/field'
import readonly from '../decorators/readonly'

import type Collection from '../Collection'
import type CollectionMap from '../Database/CollectionMap'
import { type TableName, type ColumnName, columnName } from '../Schema'
import type { Value } from '../QueryDescription'
import { type RawRecord, sanitizedRaw, setRawSanitized } from '../RawRecord'
import { setRawColumnChange } from '../sync/helpers'

import { createTimestampsFor, hasUpdatedAt } from './helpers'

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
  static table: TableName<$FlowFixMe<this>>

  // Set this in concrete Models to define relationships between different records
  static associations: Associations = {}

  _raw: RawRecord

  _isEditing = false

  // `false` when instantiated but not yet in the database
  _isCommitted: boolean = true

  // `true` when prepareUpdate was called, but not yet sent to be executed
  // turns to `false` the moment the update is sent to be executed, even if database
  // did not respond yet
  _hasPendingUpdate: boolean = false

  _hasPendingDelete: false | 'mark' | 'destroy' = false

  _changes = new BehaviorSubject(this)

  @readonly
  @field('id')
  id: RecordId

  @readonly
  @field('_status')
  syncStatus: SyncStatus

  // Modifies the model (using passed function) and saves it to the database.
  // Touches `updatedAt` if available.
  //
  // Example:
  // someTask.update(task => {
  //   task.name = 'New name'
  // })
  async update(recordUpdater: this => void = noop): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.update() can only be called from inside of an Action. See docs for more details.`,
    )
    this.prepareUpdate(recordUpdater)
    await this.collection.database.batch(this)
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
    if (hasUpdatedAt(this)) {
      this._setRaw(columnName('updated_at'), Date.now())
    }

    // Perform updates
    ensureSync(recordUpdater(this))
    this._isEditing = false
    this._hasPendingUpdate = true

    // TODO: `process.nextTick` doesn't work on React Native
    // We could polyfill with setImmediate, but it doesn't have the same effect — test and enseure
    // it would actually work for this purpose
    if (isDevelopment && process && process.nextTick) {
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
    this.prepareMarkAsDeleted()
    await this.collection.database.batch(this)
  }

  // Pernamently removes this record from the database
  // Note: Don't use this when using Sync
  async destroyPermanently(): Promise<void> {
    this.collection.database._ensureInAction(
      `Model.destroyPermanently() can only be called from inside of an Action. See docs for more details.`,
    )
    this.prepareDestroyPermanently()
    await this.collection.database.batch(this)
  }

  // *** Observing changes ***

  // Returns an observable that emits `this` upon subscription and every time this record changes
  // Emits `complete` if this record is destroyed
  observe(): Observable<this> {
    invariant(this._isCommitted, `Cannot observe uncommitted record`)
    return this._changes
  }

  // *** Implementation details ***

  collection: Collection<$FlowFixMe<this>>

  // Collections of other Models in the same domain as this record
  get collections(): CollectionMap {
    return this.collection.database.collections
  }

  // See: Database.batch()
  // To be used by Model subclass methods only
  batch(...records: $ReadOnlyArray<Model>): Promise<void> {
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

  _notifyChanged(): void {
    this._changes.next(this)
  }

  _notifyDestroyed(): void {
    this._changes.complete()
  }

  _getRaw(rawFieldName: ColumnName): Value {
    return this._raw[(rawFieldName: string)]
  }

  _setRaw(rawFieldName: ColumnName, rawValue: Value): void {
    invariant(this._isEditing, 'Not allowed to change record outside of create/update()')
    invariant(
      !this._changes.isStopped && this._raw._status !== 'deleted',
      'Not allowed to change deleted records',
    )

    setRawColumnChange(this._raw, rawFieldName)
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])
  }
}
