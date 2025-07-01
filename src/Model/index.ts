import { Observable, BehaviorSubject } from '../utils/rx'
import { Unsubscribe } from '../utils/subscriptions'
import invariant from '../utils/common/invariant'
import ensureSync from '../utils/common/ensureSync'
// @ts-ignore
import fromPairs from '../utils/fp/fromPairs'
import noop from '../utils/fp/noop'
import type { $RE } from '../types'

import type Database from '../Database'
import type Collection from '../Collection'
import type CollectionMap from '../Database/CollectionMap'
import { TableName, ColumnName, columnName } from '../Schema'
import type { Value } from '../QueryDescription'
import { RawRecord, DirtyRaw, sanitizedRaw, setRawSanitized } from '../RawRecord'
import { setRawColumnChange } from '../sync/helpers'

import { createTimestampsFor, hasUpdatedAt, fetchChildren } from './helpers'
import logger from '../utils/common/logger'

export type RecordId = string;

export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted';

export type BelongsToAssociation = $RE<{
  type: 'belongs_to';
  key: ColumnName;
  aliasFor?: string;
}>;
export type HasManyAssociation = $RE<{
  type: 'has_many';
  foreignKey: ColumnName;
  aliasFor?: string;
}>;
export type AssociationInfo = BelongsToAssociation | HasManyAssociation;
export type Associations = Partial<Record<TableName<any>, AssociationInfo>>;

export function associations(...associationList: [TableName<any>, AssociationInfo][]): Associations {
  return fromPairs(associationList) as any;
}

export default class Model {
  // Set this in concrete Models to the name of the database table
  static readonly table: TableName<any>;

  // Set this in concrete Models to define relationships between different records
  static associations: Associations = {};

  // @ts-ignore
  _raw: RawRecord;

  _isEditing = false

  // `false` when instantiated but not yet in the database
  _isCommitted: boolean = true;

  // `true` when prepareUpdate was called, but not yet sent to be executed
  // turns to `false` the moment the update is sent to be executed, even if database
  // did not respond yet
  _hasPendingUpdate: boolean = false;

  _hasPendingDelete: false | 'mark' | 'destroy' = false;

  __changes: BehaviorSubject<any> | null | undefined = null;

  _getChanges(): BehaviorSubject<any> {
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
  async update(recordUpdater: (arg1: this) => void = noop): Promise<void> {
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
  prepareUpdate(recordUpdater: (arg1: this) => void = noop): this {
    // invariant(this._isCommitted, `Cannot update uncommitted record`)
    // invariant(!this._hasPendingUpdate, `Cannot update a record with pending updates`)

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
    if (process.env.NODE_ENV !== 'production' && process && process.nextTick) {
      process.nextTick(() => {})
    }

    return this
  }

  prepareMarkAsDeleted(): this {
    // invariant(this._isCommitted, `Cannot mark an uncomitted record as deleted`)
    // invariant(!this._hasPendingUpdate, `Cannot mark an updated record as deleted`)

    this._isEditing = true
    this._raw._status = 'deleted'
    this._hasPendingDelete = 'mark'
    this._isEditing = false

    return this
  }

  prepareDestroyPermanently(): this {
    invariant(this._isCommitted, `Cannot mark an uncomitted record as deleted`)

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

  readonly collection: Collection<any>;

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
  batch(...records: ReadonlyArray<Model | null | undefined | false>): Promise<void> {
    return this.collection.database.batch(...records)
  }

  // TODO: Document me
  // To be used by Model subclass methods only
  subAction<T>(action: () => Promise<T>): Promise<T> {
    return this.collection.database._actionQueue.subAction(action)
  }

  get table(): TableName<this> {
    // @ts-ignore
    return this.constructor.table
  }

  // Don't use this directly! Use `collection.create()`
  constructor(collection: Collection<any>, raw: RawRecord) {
    this.collection = collection
    this._raw = raw
  }

  static fetchFromRemote(tableName: string, id: string): Promise<any> {
    logger.warn(`fetchFromRemote not implemented. Trying to fetch ${tableName}::${id}`)
    return Promise.resolve(null)
  }

  static _prepareCreate(collection: Collection<any>, recordBuilder: (arg1: any) => void): any {
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

  static _prepareCreateFromDirtyRaw(collection: Collection<any>, dirtyRaw: DirtyRaw): any {
    const record = new this(collection, sanitizedRaw(dirtyRaw, collection.schema))
    record._isCommitted = false
    return record
  }

  _subscribers: [(isDeleted: boolean) => void, any][] = [];

  experimentalSubscribe(subscriber: (isDeleted: boolean) => void, debugInfo?: any): Unsubscribe {
    const entry = [subscriber, debugInfo]
    this._subscribers.push(entry as any)

    return () => {
      const idx = this._subscribers.indexOf(entry as any)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  _notifyChanged(): void {
    this._getChanges().next(this)
    this._subscribers.forEach(([subscriber]: [any, any]) => {
      subscriber(false)
    })
  }

  _notifyDestroyed(): void {
    this._getChanges().complete()
    this._subscribers.forEach(([subscriber]: [any, any]) => {
      subscriber(true)
    })
  }

  _getRaw(rawFieldName: ColumnName): Value {
    // @ts-ignore
    return this._raw[(rawFieldName as string)];
  }

  _setRaw(rawFieldName: ColumnName, rawValue: Value): void {
    invariant(this._isEditing, 'Not allowed to change record outside of create/update()')
    invariant(
      !(this._getChanges()).isStopped &&
        this._raw._status !== 'deleted',
      'Not allowed to change deleted records',
    )

    // @ts-ignore
    const valueBefore = this._raw[(rawFieldName as string)]
    // @ts-ignore
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])

    // @ts-ignore
    if (valueBefore !== this._raw[(rawFieldName as string)]) {
      // @ts-ignore
      setRawColumnChange(this._raw, rawFieldName)
    }
  }

  // Please don't use this unless you really understand how Watermelon Sync works, and thought long and
  // hard about risks of inconsistency after sync
  _dangerouslySetRawWithoutMarkingColumnChange(rawFieldName: ColumnName, rawValue: Value): void {
    invariant(this._isEditing, 'Not allowed to change record outside of create/update()')
    invariant(
      !(this._getChanges()).isStopped &&
        this._raw._status !== 'deleted',
      'Not allowed to change deleted records',
    )

    // @ts-ignore
    setRawSanitized(this._raw, rawFieldName, rawValue, this.collection.schema.columns[rawFieldName])
  }
}
