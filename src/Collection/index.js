// @flow

import type { Observable } from 'rxjs'
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

  #cache: RecordCache<Record>

  get _cache(): RecordCache<Record> {
    invariant(process.env.NODE_ENV === 'test', '_chace can be accessed only in test environment')

    return this.#cache
  }

  constructor(database: Database, ModelClass: Class<Record>): void {
    this.database = database
    this.modelClass = ModelClass
    this.#cache = new RecordCache(ModelClass.table, raw => new ModelClass(this, raw))
  }

  // Finds a record with the given ID
  // Promise will reject if not found
  async find(id: RecordId): Promise<Record> {
    invariant(id, `Invalid record ID ${this.table}#${id}`)

    const cachedRecord = this.#cache.get(id)
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

  // *** Implementation of Query APIs ***

  // See: Query.fetch
  async fetchQuery(query: Query<Record>): Promise<Record[]> {
    const rawRecords = await this.database.adapter.query(query)

    return this.#cache.recordsFromQueryResult(rawRecords)
  }

  // See: Query.fetchCount
  fetchCount(query: Query<Record>): Promise<number> {
    return this.database.adapter.count(query)
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
    return this.#cache.recordFromQueryResult(raw)
  }

  async _markAsDeleted(record: Record): Promise<void> {
    await this.database.adapter.batch([['markAsDeleted', record]])
    this._onRecordDestroyed(record)
  }

  async _destroyPermanently(record: Record): Promise<void> {
    await this.database.adapter.batch([['destroyPermanently', record]])
    this._onRecordDestroyed(record)
  }

  changeSet(operations: CollectionChangeSet<Record>): void {
    operations.forEach(({ record, type }) => {
      if (type === CollectionChangeTypes.created) {
        record._isCommitted = true
        this.#cache.add(record)
      }
    })

    this.changes.next(operations)

    operations.forEach(({ record, type }) => {
      if (type === CollectionChangeTypes.updated) {
        record._notifyChanged()
      }
    })
  }

  _onRecordDestroyed(record: Record): void {
    this.#cache.delete(record)
    this.changes.next([{ record, type: CollectionChangeTypes.destroyed }])
    record._notifyDestroyed()
  }

  // See: Database.unsafeClearCaches
  unsafeClearCache(): void {
    this.#cache.unsafeClear()
  }
}
