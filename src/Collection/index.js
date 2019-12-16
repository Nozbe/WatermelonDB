// @flow

import type { Observable } from 'rxjs'
import { Subject } from 'rxjs/Subject'
import { defer } from 'rxjs/observable/defer'
import { switchMap } from 'rxjs/operators'
import invariant from '../utils/common/invariant'
import noop from '../utils/fp/noop'
import { type Result } from '../utils/fp/Result'
import { type Unsubscribe } from '../utils/subscriptions'

import Query from '../Query'
import type Database from '../Database'
import type Model, { RecordId } from '../Model'
import type { Condition } from '../QueryDescription'
import { type TableName, type TableSchema } from '../Schema'
import { type DirtyRaw } from '../RawRecord'

import RecordCache from './RecordCache'
import { CollectionChangeTypes } from './common'
import type { SQLDatabaseAdapter } from '../adapters/type'

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
    return cachedRecord || this._fetchRecord(id)
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
      typeof (adapter: any).unsafeSqlQuery === 'function',
      'unsafeFetchRecordsWithSQL called on database that does not support SQL',
    )
    const sqlAdapter: SQLDatabaseAdapter = (adapter: any)
    const rawRecords = await sqlAdapter.unsafeSqlQuery(this.modelClass.table, sql)

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
  _fetchQuery(query: Query<Record>, callback: (Result<Record[]>) => void): void {
    this.database.adapter.query(query.serialize(), result => {
      if (result.value) {
        callback({ value: this._cache.recordsFromQueryResult(result.value) })
      } else {
        callback(result)
      }
    })
  }

  // See: Query.fetchCount
  _fetchCount(query: Query<Record>, callback: (Result<number>) => void): void {
    this.database.adapter.count(query.serialize(), callback)
  }

  // Fetches exactly one record (See: Collection.find)
  _fetchRecord(id: RecordId, callback: (Result<Record>) => void): void {
    this.database.adapter.find(this.table, id, result => {
      if (result.value) {
        callback({ value: this._cache.recordFromQueryResult(result.value) })
      } else {
        callback({ error: new Error(`Record ${this.table}#${id} not found`) })
      }
    })
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
