// @flow
import { Observable, Subject } from '../utils/rx'
import { type ResultCallback } from '../utils/fp/Result'
import { type Unsubscribe } from '../utils/subscriptions'

import Query from '../Query'
import * as Q from '../QueryDescription'
import type Database from '../Database'
import type Model from '../Model'
import type { RecordId } from '../Model'
import type { Clause } from '../QueryDescription'
import { type TableName, type TableSchema } from '../Schema'
import { type DirtyRaw } from '../RawRecord'

import RecordCache from './RecordCache'

type CollectionChangeType = 'created' | 'updated' | 'destroyed'
export type CollectionChange<Record extends Model> = { record: Record, type: CollectionChangeType }
export type CollectionChangeSet<T extends Model> = CollectionChange<T>[]

export default class Collection<Record extends Model> {
  database: Database

  modelClass: Record

  // Emits event every time a record inside Collection changes or is deleted
  // (Use Query API to observe collection changes)
  changes: Subject<CollectionChangeSet<Record>>;

  _cache: RecordCache<Record>

  constructor(database: Database, ModelClass: Record);

  get db(): Database;

  // Finds a record with the given ID
  // Promise will reject if not found
  find(id: RecordId): Promise<Record>;

  // Finds the given record and starts observing it
  // (with the same semantics as when calling `model.observe()`)
  findAndObserve(id: RecordId): Observable<Record>;

  // Query records of this type
  query(...clauses: Clause[]): Query<Record>;

  // Creates a new record in this collection
  // Pass a function to set attributes of the record.
  //
  // Example:
  // collections.get(Tables.tasks).create(task => {
  //   task.name = 'Task name'
  // })
  create(recordBuilder: (record: Record) => void): Promise<Record>;

  // Prepares a new record in this collection
  // Use this to batch-create multiple records
  prepareCreate(recordBuilder: (Record) => void): Record;

  // Prepares a new record in this collection based on a raw object
  // e.g. `{ foo: 'bar' }`. Don't use this unless you know how RawRecords work in WatermelonDB
  // this is useful as a performance optimization or if you're implementing your own sync mechanism
  prepareCreateFromDirtyRaw(dirtyRaw: DirtyRaw): Record;

  // Prepares a disposable record in this collection based on a raw object, e.g. `{ foo: 'bar' }`.
  // Disposable records are read-only, cannot be saved in the database, updated, or deleted
  // they only exist for as long as you keep a reference to them in memory.
  // Don't use this unless you know how RawRecords work in WatermelonDB.
  // This is useful when you're adding online-only features to an otherwise offline-first app
  disposableFromDirtyRaw(dirtyRaw: DirtyRaw): Record;

  // *** Implementation of Query APIs ***

  unsafeFetchRecordsWithSQL(sql: string): Promise<Record[]>;

  // *** Implementation details ***

  get table(): TableName<Record>;

  get schema(): TableSchema;

  // See: Query.fetch
  _fetchQuery(query: Query<Record>, callback: ResultCallback<Record[]>): void;

  _fetchIds(query: Query<Record>, callback: ResultCallback<RecordId[]>): void;

  _fetchCount(query: Query<Record>, callback: ResultCallback<number>): void;

  _unsafeFetchRaw(query: Query<Record>, callback: ResultCallback<any[]>): void;

  // Fetches exactly one record (See: Collection.find)
  _fetchRecord(id: RecordId, callback: ResultCallback<Record>): void;

  _applyChangesToCache(operations: CollectionChangeSet<Record>): void;

  _notify(operations: CollectionChangeSet<Record>): void;

  _subscribers: [(operations: CollectionChangeSet<Record>) => void, any][];

  experimentalSubscribe(
    subscriber: (operations: CollectionChangeSet<Record>) => void,
    debugInfo?: any,
  ): Unsubscribe;
}
