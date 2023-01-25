// @flow
import { Observable, Subject } from '../utils/rx'
import invariant from '../utils/common/invariant'
import deprecated from '../utils/common/deprecated'
import noop from '../utils/fp/noop'
import { type ResultCallback, toPromise, mapValue } from '../utils/fp/Result'
import { type Unsubscribe } from '../utils/subscriptions'

import Query from '../Query'
import * as Q from '../QueryDescription'
import type Database from '../Database'
import type Model, { RecordId } from '../Model'
import type { Clause } from '../QueryDescription'
import { type TableName, type TableSchema } from '../Schema'
import { type DirtyRaw } from '../RawRecord'

import RecordCache from './RecordCache'

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
    this._cache = new RecordCache<Record>(
      (ModelClass.table: $FlowFixMe),
      (raw) => new ModelClass((this: $FlowFixMe), raw),
      this,
    )
  }

  get db(): Database {
    return this.database
  }

  // Finds a record with the given ID
  // Promise will reject if not found
  async find(id: RecordId): Promise<Record> {
    return toPromise((callback) => this._fetchRecord(id, callback))
  }

  // Finds the given record and starts observing it
  // (with the same semantics as when calling `model.observe()`)
  findAndObserve(id: RecordId): Observable<Record> {
    return Observable.create((observer) => {
      let unsubscribe = null
      let unsubscribed = false
      this._fetchRecord(id, (result) => {
        if (result.value) {
          const record = result.value
          observer.next(record)
          unsubscribe = record.experimentalSubscribe((isDeleted) => {
            if (!unsubscribed) {
              isDeleted ? observer.complete() : observer.next(record)
            }
          })
        } else {
          // $FlowFixMe
          observer.error(result.error)
        }
      })
      return () => {
        unsubscribed = true
        unsubscribe && unsubscribe()
      }
    })
  }

  // Query records of this type
  query(...clauses: Clause[]): Query<Record> {
    return new Query(this, clauses)
  }

  // Creates a new record in this collection
  // Pass a function to set attributes of the record.
  //
  // Example:
  // collections.get(Tables.tasks).create(task => {
  //   task.name = 'Task name'
  // })
  async create(recordBuilder: (Record) => void = noop): Promise<Record> {
    this.database._ensureInWriter(`Collection.create()`)

    const record = this.prepareCreate(recordBuilder)
    await this.database.batch(record)
    return record
  }

  // Prepares a new record in this collection
  // Use this to batch-create multiple records
  prepareCreate(recordBuilder: (Record) => void = noop): Record {
    // $FlowFixMe
    return this.modelClass._prepareCreate(this, recordBuilder)
  }

  // Prepares a new record in this collection based on a raw object
  // e.g. `{ foo: 'bar' }`. Don't use this unless you know how RawRecords work in WatermelonDB
  // this is useful as a performance optimization or if you're implementing your own sync mechanism
  prepareCreateFromDirtyRaw(dirtyRaw: DirtyRaw): Record {
    // $FlowFixMe
    return this.modelClass._prepareCreateFromDirtyRaw(this, dirtyRaw)
  }

  // Prepares a disposable record in this collection based on a raw object, e.g. `{ foo: 'bar' }`.
  // Disposable records are read-only, cannot be saved in the database, updated, or deleted
  // they only exist for as long as you keep a reference to them in memory.
  // Don't use this unless you know how RawRecords work in WatermelonDB.
  // This is useful when you're adding online-only features to an otherwise offline-first app
  disposableFromDirtyRaw(dirtyRaw: DirtyRaw): Record {
    // $FlowFixMe
    return this.modelClass._disposableFromDirtyRaw(this, dirtyRaw)
  }

  // *** Implementation of Query APIs ***

  unsafeFetchRecordsWithSQL(sql: string): Promise<Record[]> {
    if (process.env.NODE_ENV !== 'production') {
      deprecated(
        'Collection.unsafeFetchRecordsWithSQL()',
        'Use .query(Q.unsafeSqlQuery(`select * from...`)).fetch() instead.',
      )
    }
    return this.query(Q.unsafeSqlQuery(sql)).fetch()
  }

  // *** Implementation details ***

  get table(): TableName<Record> {
    // $FlowFixMe
    return this.modelClass.table
  }

  get schema(): TableSchema {
    return this.database.schema.tables[this.table]
  }

  // See: Query.fetch
  _fetchQuery(query: Query<Record>, callback: ResultCallback<Record[]>): void {
    this.database.adapter.underlyingAdapter.query(query.serialize(), (result) =>
      callback(mapValue((rawRecords) => this._cache.recordsFromQueryResult(rawRecords), result)),
    )
  }

  _fetchIds(query: Query<Record>, callback: ResultCallback<RecordId[]>): void {
    this.database.adapter.underlyingAdapter.queryIds(query.serialize(), callback)
  }

  _fetchCount(query: Query<Record>, callback: ResultCallback<number>): void {
    this.database.adapter.underlyingAdapter.count(query.serialize(), callback)
  }

  _unsafeFetchRaw(query: Query<Record>, callback: ResultCallback<any[]>): void {
    this.database.adapter.underlyingAdapter.unsafeQueryRaw(query.serialize(), callback)
  }

  // Fetches exactly one record (See: Collection.find)
  _fetchRecord(id: RecordId, callback: ResultCallback<Record>): void {
    if (typeof id !== 'string') {
      callback({ error: new Error(`Invalid record ID ${this.table}#${id}`) })
      return
    }

    const cachedRecord = this._cache.get(id)

    if (cachedRecord) {
      callback({ value: cachedRecord })
      return
    }

    this.database.adapter.underlyingAdapter.find(this.table, id, (result) =>
      callback(
        mapValue((rawRecord) => {
          invariant(rawRecord, `Record ${this.table}#${id} not found`)
          return this._cache.recordFromQueryResult(rawRecord)
        }, result),
      ),
    )
  }

  _applyChangesToCache(operations: CollectionChangeSet<Record>): void {
    operations.forEach(({ record, type }) => {
      if (type === 'created') {
        record._preparedState = null
        this._cache.add(record)
      } else if (type === 'destroyed') {
        this._cache.delete(record)
      }
    })
  }

  _notify(operations: CollectionChangeSet<Record>): void {
    const collectionChangeNotifySubscribers = ([subscriber]: [(CollectionChangeSet<Record>) => void, any]): void => {
      subscriber(operations)
    }
    this._subscribers.forEach(collectionChangeNotifySubscribers)
    this.changes.next(operations)

    const collectionChangeNotifyModels = ({record, type}: CollectionChange<Record>): void => {
      if (type === 'updated') {
        record._notifyChanged()
      } else if (type === 'destroyed') {
        record._notifyDestroyed()
      }
    }
    operations.forEach(collectionChangeNotifyModels)
  }

  _subscribers: [(CollectionChangeSet<Record>) => void, any][] = []

  experimentalSubscribe(
    subscriber: (CollectionChangeSet<Record>) => void,
    debugInfo?: any,
  ): Unsubscribe {
    const entry = [subscriber, debugInfo]
    this._subscribers.push(entry)

    return () => {
      const idx = this._subscribers.indexOf(entry)
      idx !== -1 && this._subscribers.splice(idx, 1)
    }
  }
}
