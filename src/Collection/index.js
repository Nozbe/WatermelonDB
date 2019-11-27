// @flow

import { Observable } from 'rxjs/Observable'

import { Subject } from 'rxjs/Subject'
import { defer } from 'rxjs/observable/defer'
import { switchMap } from 'rxjs/operators'
import invariant from '../utils/common/invariant'
import noop from '../utils/fp/noop'

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

  findBisync(id: RecordId, callback: any => void) {
    if (!id) {
      callback({ error: new Error(`Invalid record ID ${this.table}#${id}`) })
      return
    }

    const cachedRecord = this._cache.get(id)
    if (cachedRecord) {
      callback({ value: cachedRecord })
      return
    }

    this._fetchRecordBisync(id, callback)
  }

  // Finds the given record and starts observing it
  // (with the same semantics as when calling `model.observe()`)
  findAndObserve(id: RecordId): Observable<Record> {
    // return defer(() => this.find(id)).pipe(switchMap(model => model.observe()))
    return Observable.create(observer => {
      this.findBisync(id, result => {
        if (result.value) {
          observer.next(result.value)
        } else {
          observer.error(result.error)
        }
      })
    }).pipe(switchMap(model => model.observe()))
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

  // See: Query.fetch
  async fetchQuery(query: Query<Record>): Promise<Record[]> {
    const rawRecords = await this.database.adapter.query(query.serialize())

    return this._cache.recordsFromQueryResult(rawRecords)
  }

  fetchQueryBisync(query: Query<Record>, callback: any => void): void {
    this.database.adapter.queryBisync(query.serialize(), result => {
      if (result.value) {
        const rawRecords = result.value
        const records = this._cache.recordsFromQueryResult(rawRecords)
        // console.log('fetchQueryBisync', records.map(x => x._raw || x))
        callback({ value: records })
      } else {
        callback(result)
      }
    })
  }

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

  // See: Query.fetchCount
  fetchCount(query: Query<Record>): Promise<number> {
    return this.database.adapter.count(query.serialize())
  }

  fetchCountBisync(query: Query<Record>, callback: any => void): void {
    this.database.adapter.countBisync(query.serialize(), callback)
  }

  // *** Implementation details ***

  get table(): TableName<Record> {
    return this.modelClass.table
  }

  get schema(): TableSchema {
    return this.database.schema.tables[this.table]
  }

  // Fetches exactly one record (See: Collection.find)
  async _fetchRecord(id: RecordId): Promise<Record> {
    const raw = await this.database.adapter.find(this.table, id)
    invariant(raw, `Record ${this.table}#${id} not found`)
    return this._cache.recordFromQueryResult(raw)
  }

  _fetchRecordBisync(id: RecordId, callback: any => void): void {
    this.database.adapter.findBisync(this.table, id, result => {
      if (result.value) {
        const raw = result.value
        if (raw) {
          callback({ value: this._cache.recordFromQueryResult(raw) })
        } else {
          callback({ error: new Error(`Record ${this.table}#${id} not found`) })
        }
      } else {
        callback(result)
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

    this.changes.next(operations)

    this._subscribers.forEach(subscriber => {
      subscriber(operations)
    })

    operations.forEach(({ record, type }) => {
      if (type === CollectionChangeTypes.updated) {
        record._notifyChanged()
      } else if (type === CollectionChangeTypes.destroyed) {
        record._notifyDestroyed()
      }
    })
  }

  _subscribers: any[] = []

  subscribeToChanges(subscriber: Function): any {
    this._subscribers.push(subscriber)

    return () => {
      // todo
    }
  }

  // See: Database.unsafeClearCaches
  unsafeClearCache(): void {
    this._cache.unsafeClear()
  }
}
