import { type Observable, BehaviorSubject } from '../utils/rx'
import { type Unsubscribe } from '../utils/subscriptions'
import type { $RE, $ReadOnlyArray } from '../types'

import type Database from '../Database'
import type Collection from '../Collection'
import type CollectionMap from '../Database/CollectionMap'
import { type TableName, type ColumnName, columnName } from '../Schema'
import type { Value } from '../QueryDescription'
import { type RawRecord, type DirtyRaw, sanitizedRaw, setRawSanitized } from '../RawRecord'

export type RecordId = string

// NOTE: status 'disposable' MUST NOT ever appear in a persisted record
export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted' | 'disposable'

export type BelongsToAssociation = $RE<{ type: 'belongs_to'; key: ColumnName }>
export type HasManyAssociation = $RE<{ type: 'has_many'; foreignKey: ColumnName }>
export type AssociationInfo = BelongsToAssociation | HasManyAssociation
export type Associations = { [tableName: TableName<any>]: AssociationInfo }

export function associations(...associationList: [TableName<any>, AssociationInfo][]): Associations

export default class Model {
  // Set this in concrete Models to the name of the database table
  static table: TableName<Model>

  // Set this in concrete Models to define relationships between different records
  static associations: Associations

  // Used by withObservables to differentiate between object types
  static _wmelonTag: string

  _raw: RawRecord

  _isEditing: boolean

  _preparedState: null | 'create' | 'update' | 'markAsDeleted' | 'destroyPermanently'

  __changes?: BehaviorSubject<any>

  _getChanges(): BehaviorSubject<any>

  get id(): RecordId

  get syncStatus(): SyncStatus

  // Modifies the model (using passed function) and saves it to the database.
  // Touches `updatedAt` if available.
  //
  // Example:
  // someTask.update(task => {
  //   task.name = 'New name'
  // })
  update(recordUpdater: (_: this) => void): Promise<this>

  // Prepares an update to the database (using passed function).
  // Touches `updatedAt` if available.
  //
  // After preparing an update, you must execute it synchronously using
  // database.batch()
  prepareUpdate(recordUpdater: (_: this) => void): this

  prepareMarkAsDeleted(): this

  prepareDestroyPermanently(): this

  // Marks this record as deleted (will be permanently deleted after sync)
  // Note: Use this only with Sync
  markAsDeleted(): Promise<void>

  // Pernamently removes this record from the database
  // Note: Don't use this when using Sync
  destroyPermanently(): Promise<void>

  experimentalMarkAsDeleted(): Promise<void>

  experimentalDestroyPermanently(): Promise<void>

  // *** Observing changes ***

  // Returns an observable that emits `this` upon subscription and every time this record changes
  // Emits `complete` if this record is destroyed
  observe(): Observable<this>

  // *** Implementation details ***

  collection: Collection<Model>

  // Collections of other Models in the same domain as this record
  get collections(): CollectionMap

  get database(): Database

  get db(): Database

  get asModel(): this

  // See: Database.batch()
  // To be used by Model @writer methods only!
  // TODO: protect batch,callWriter,... from being used outside a @reader/@writer
  batch(...records: $ReadOnlyArray<Model | null | void | false>): Promise<void>

  // To be used by Model @writer methods only!
  callWriter<T>(action: () => Promise<T>): Promise<T>

  // To be used by Model @writer/@reader methods only!
  callReader<T>(action: () => Promise<T>): Promise<T>

  // To be used by Model @writer/@reader methods only!
  subAction<T>(action: () => Promise<T>): Promise<T>

  get table(): TableName<this>

  // FIX_TS
  // Don't use this directly! Use `collection.create()`
  constructor(collection: Collection<Model>, raw: RawRecord)

  // FIX_TS
  static _prepareCreate(collection: Collection<Model>, recordBuilder: (this) => void)

  // FIX_TS
  static _prepareCreateFromDirtyRaw(collection: Collection<Model>, dirtyRaw: DirtyRaw)

  // FIX_TS
  static _disposableFromDirtyRaw(collection: Collection<Model>, dirtyRaw: DirtyRaw)

  _subscribers: [(isDeleted: boolean) => void, any][]

  experimentalSubscribe(subscriber: (isDeleted: boolean) => void, debugInfo?: any): Unsubscribe

  _notifyChanged(): void

  _notifyDestroyed(): void

  _getRaw(rawFieldName: ColumnName): Value

  _setRaw(rawFieldName: ColumnName, rawValue: Value): void

  // Please don't use this unless you really understand how Watermelon Sync works, and thought long and
  // hard about risks of inconsistency after sync
  _dangerouslySetRawWithoutMarkingColumnChange(rawFieldName: ColumnName, rawValue: Value): void

  __ensureCanSetRaw(): void

  __ensureNotDisposable(debugName: string): void
}
