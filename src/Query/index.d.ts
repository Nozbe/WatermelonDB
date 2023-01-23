import { Observable } from '../utils/rx'
import { type Unsubscribe, SharedSubscribable } from '../utils/subscriptions'
import { $Exact } from '../types'

import type { Clause, QueryDescription } from '../QueryDescription'
import type Model from '../Model'
import type { AssociationInfo, RecordId } from '../Model'
import type Collection from '../Collection'
import type { TableName, ColumnName } from '../Schema'

export type QueryAssociation = $Exact<{
  from: TableName<any>
  to: TableName<any>
  info: AssociationInfo
}>

export type SerializedQuery = $Exact<{
  table: TableName<any>
  description: QueryDescription
  associations: QueryAssociation[]
}>

interface QueryCountProxy {
  then<U>(
    onFulfill?: (value: number) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U>
}

export default class Query<Record extends Model> {
  // Used by withObservables to differentiate between object types
  static _wmelonTag: string

  collection: Collection<Record>

  description: QueryDescription

  _rawDescription: QueryDescription

  _cachedSubscribable: SharedSubscribable<Record[]>

  _cachedCountSubscribable: SharedSubscribable<number>

  _cachedCountThrottledSubscribable: SharedSubscribable<number>

  // Note: Don't use this directly, use Collection.query(...)
  constructor(collection: Collection<Record>, clauses: Clause[])

  // Creates a new Query that extends the clauses of this query
  extend(...clauses: Clause[]): Query<Record>

  pipe<T>(transform: (this) => T): T

  // Queries database and returns an array of matching records
  fetch(): Promise<Record[]>

  then<U>(
    onFulfill?: (value: Record[]) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U>

  // Emits an array of matching records, then emits a new array every time it changes
  observe(): Observable<Record[]>

  // Same as `observe()` but also emits the list when any of the records
  // on the list has one of `columnNames` chaged
  observeWithColumns(columnNames: ColumnName[]): Observable<Record[]>

  // Queries database and returns the number of matching records
  fetchCount(): Promise<number>

  get count(): QueryCountProxy

  // Emits the number of matching records, then emits a new count every time it changes
  // Note: By default, the Observable is throttled!
  observeCount(isThrottled: boolean): Observable<number>

  // Queries database and returns an array with IDs of matching records
  fetchIds(): Promise<RecordId[]>

  // Queries database and returns an array with unsanitized raw results
  // You MUST NOT mutate these objects!
  unsafeFetchRaw(): Promise<any[]>

  experimentalSubscribe(subscriber: (records: Record[]) => void): Unsubscribe

  experimentalSubscribeWithColumns(
    columnNames: ColumnName[],
    subscriber: (records: Record[]) => void,
  ): Unsubscribe

  experimentalSubscribeToCount(subscriber: (number) => void): Unsubscribe

  // Marks as deleted all records matching the query
  markAllAsDeleted(): Promise<void>

  // Destroys all records matching the query
  destroyAllPermanently(): Promise<void>

  // MARK: - Internals

  get modelClass(): Record

  get table(): TableName<Record>

  get secondaryTables(): TableName<any>[]

  get allTables(): TableName<any>[]

  get associations(): QueryAssociation[]

  // Serialized version of Query (e.g. for sending to web worker)
  serialize(): SerializedQuery
}
