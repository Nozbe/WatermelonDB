// @flow

import type { Observable } from 'rxjs'
import { Subject } from 'rxjs/Subject'
import { defer } from 'rxjs/observable/defer'
import { switchMap } from 'rxjs/operators'
import invariant from '../utils/common/invariant'
import noop from '../utils/fp/noop'
import { type ResultCallback, toPromise, mapValue } from '../utils/fp/Result'
import { type Unsubscribe } from '../utils/subscriptions'

import Query from '../Query'
import type Database from '../Database'
import type Model, { RecordId } from '../Model'
import type { Condition } from '../QueryDescription'
import { type TableName, type TableSchema } from '../Schema'
import { type DirtyRaw, type RecordState } from '../RawRecord'

import RecordCache from './RecordCache'
import { CollectionChangeTypes } from './common'

type CollectionChangeType = 'created' | 'updated' | 'destroyed'
export type CollectionChange<Record: Model> = { record: Record, type: CollectionChangeType }
export type CollectionChangeSet<T> = CollectionChange<T>[]

export default class Collection<Record: Model> {
  database: Database

  modelClass: Class<Record>

  // Emits event every time a record inside Collection changes or is deleted
  // (Use Query API to observe collection changes)
  changes: Subject<CollectionChangeSet<Record>> = new Subject()

  _cache: RecordCache<Record>

  constructor(database: Database, ModelClass: Class<Record>): void {
    this.database = database
    this.modelClass = ModelClass
    this._cache = new RecordCache(ModelClass.table, raw => new ModelClass(this, raw))
  }

  // Finds a record with the given ID
  // Promise will reject if not found
  async find(id: RecordId): Promise<Record> {
    invariant(id, `Invalid record ID ${this.table}#${id}`)

    const cachedRecord = this._cache.get(id)
    return cachedRecord || toPromise(callback => this._fetchRecord(id, callback))
  }

  // Finds the given record and starts observing it
  // (with the same semantics as when calling `model.observe()`)
  findAndObserve(id: RecordId): Observable<Record> {
    return defer(() => this.find(id)).pipe(switchMap(model => model.observe()))
  }

  // Query records of this type
  query(...conditions: Condition[]): Query<Record> {
    return new Query(this, conditions)
  }

  // Creates a new record in this collection
  // Pass a function to set attributes of the record.
  //
  // Example:
  // collections.get(Tables.tasks).create(task => {
  //   task.name = 'Task name'
  // })
  async create(recordBuilder: Record => void = noop): Promise<Record> {
    this.database._ensureInAction(
      `Collection.create() can only be called from inside of an Action. See docs for more details.`,
    )

    const record = this.prepareCreate(recordBuilder)
    await this.database.batch(record)
    return record
  }

  // Prepares a new record in this collection
  // Use this to batch-create multiple records
  prepareCreate(recordBuilder: Record => void = noop): Record {
    return this.modelClass._prepareCreate(this, recordBuilder)
  }

  // Prepares a new record in this collection based on a raw object
  // e.g. `{ foo: 'bar' }`. Don't use this unless you know how RawRecords work in WatermelonDB
  // this is useful as a performance optimization or if you're implementing your own sync mechanism
  prepareCreateFromDirtyRaw(dirtyRaw: DirtyRaw): Record {
    return this.modelClass._prepareCreateFromDirtyRaw(this, dirtyRaw)
  }

  // *** Implementation of Query APIs ***

  async unsafeFetchRecordsWithSQL(sql: string): Promise<Record[]> {
    const { adapter } = this.database
    invariant(
      typeof adapter.unsafeSqlQuery === 'function',
      'unsafeFetchRecordsWithSQL called on database that does not support SQL',
    )
    const rawRecords = await adapter.unsafeSqlQuery(this.modelClass.table, sql)

    return this._cache.recordsFromQueryResult(rawRecords)
  }

  // *** Implementation details ***

  get table(): TableName<Record> {
    return this.modelClass.table
  }

  get schema(): TableSchema {
    return this.database.schema.tables[this.table]
  }

  // See: Query.fetch
  _fetchQuery(query: Query<Record>, callback: ResultCallback<Record[]>): void {
    this.database.adapter.underlyingAdapter.query(query.serialize(), result =>
      callback(mapValue(rawRecords => this._cache.recordsFromQueryResult(rawRecords), result)),
    )
  }

  _fetchQuerySelect(query: Query<Record>, callback: ResultCallback<RecordState[]>): void {
    this.database.adapter.underlyingAdapter.query(query.serialize(), result => {
      callback(
        mapValue(rawRecords => {
          return rawRecords.map(rawRecordOrId => {
            if (typeof rawRecordOrId === 'string') {
              const rawRecord = this._cache._cachedModelForId(rawRecordOrId)._raw
              return query._getRecordState(rawRecord)
            }
            return query._getRecordState(rawRecordOrId)
          })
        }, result),
      )
    })
  }

  // See: Query.fetchCount
  _fetchCount(query: Query<Record>, callback: ResultCallback<number>): void {
    this.database.adapter.underlyingAdapter.count(query.serialize(), callback)
  }

  // Fetches exactly one record (See: Collection.find)
  _fetchRecord(id: RecordId, callback: ResultCallback<Record>): void {
    this.database.adapter.underlyingAdapter.find(this.table, id, result =>
      callback(
        mapValue(rawRecord => {
          invariant(rawRecord, `Record ${this.table}#${id} not found`)
          return this._cache.recordFromQueryResult(rawRecord)
        }, result),
      ),
    )
  }

  changeSet(operations: CollectionChangeSet<Record>): void {
    operations.forEach(({ record, type }) => {
      if (type === CollectionChangeTypes.created) {
        record._isCommitted = true
        this._cache.add(record)
      } else if (type === CollectionChangeTypes.destroyed) {
        this._cache.delete(record)
      }
    })

    this._subscribers.forEach(subscriber => {
      subscriber(operations)
    })
    this.changes.next(operations)

    operations.forEach(({ record, type }) => {
      if (type === CollectionChangeTypes.updated) {
        record._notifyChanged()
      } else if (type === CollectionChangeTypes.destroyed) {
        record._notifyDestroyed()
      }
    })
  }

  _subscribers: Array<(CollectionChangeSet<Record>) => void> = []

  experimentalSubscribe(subscriber: (CollectionChangeSet<Record>) => void): Unsubscribe {
    this._subscribers.push(subscriber)

    return () => {
      const idx = this._subscribers.indexOf(subscriber)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }

  // See: Database.unsafeClearCaches
  unsafeClearCache(): void {
    this._cache.unsafeClear()
  }
}
