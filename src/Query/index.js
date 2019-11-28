// @flow

import { Observable } from 'rxjs/Observable'
import { prepend } from 'rambdax'

import cacheWhileConnected from '../utils/rx/cacheWhileConnected'
import allPromises from '../utils/fp/allPromises'

// TODO: ?
import lazy from '../decorators/lazy' // import from decorarators break the app on web production WTF ¯\_(ツ)_/¯

import subscribeToCount from '../observation/subscribeToCount'
import observeQuery from '../observation/observeQuery'
import observeQueryWithColumns from '../observation/observeQueryWithColumns'
import { buildQueryDescription, queryWithoutDeleted } from '../QueryDescription'
import type { Condition, QueryDescription } from '../QueryDescription'
import type Model, { AssociationInfo } from '../Model'
import type Collection from '../Collection'
import type { TableName, ColumnName } from '../Schema'

import { getSecondaryTables, getAssociations } from './helpers'

export type AssociationArgs = [TableName<any>, AssociationInfo]
export type SerializedQuery = $Exact<{
  table: TableName<any>,
  description: QueryDescription,
  associations: AssociationArgs[],
}>

function observeCount<Record: Model>(
  // eslint-disable-next-line no-use-before-define
  query: Query<Record>,
  isThrottled: boolean,
): Observable<number> {
  return Observable.create(observer => {
    return subscribeToCount(query, isThrottled, count => {
      observer.next(count)
    })
  })
}

export default class Query<Record: Model> {
  collection: Collection<Record>

  description: QueryDescription

  _rawDescription: QueryDescription

  @lazy
  _cachedObservable: Observable<Record[]> = observeQuery(this).pipe(cacheWhileConnected)

  @lazy
  _cachedCountObservable: Observable<number> = observeCount(this, false).pipe(cacheWhileConnected)

  @lazy
  _cachedCountThrottledObservable: Observable<number> = observeCount(this, true).pipe(
    cacheWhileConnected,
  )

  // Note: Don't use this directly, use Collection.query(...)
  constructor(collection: Collection<Record>, conditions: Condition[]): void {
    this.collection = collection
    this._rawDescription = buildQueryDescription(conditions)
    this.description = queryWithoutDeleted(this._rawDescription)
  }

  // Creates a new Query that extends the conditions of this query
  extend(...conditions: Condition[]): Query<Record> {
    const { collection } = this
    const { join, where } = this._rawDescription

    return new Query(collection, [...join, ...where, ...conditions])
  }

  pipe<T>(transform: this => T): T {
    return transform(this)
  }

  // Queries database and returns an array of matching records
  fetch(): Promise<Record[]> {
    return this.collection.fetchQuery(this)
  }

  // Emits an array of matching records, then emits a new array every time it changes
  observe(): Observable<Record[]> {
    return this._cachedObservable
  }

  // Same as `observe()` but also emits the list when any of the records
  // on the list has one of `columnNames` chaged
  observeWithColumns(columnNames: ColumnName[]): Observable<Record[]> {
    // TODO: Would be nice to cache this
    return observeQueryWithColumns(this, columnNames)
  }

  // Returns the number of matching records
  fetchCount(): Promise<number> {
    return this.collection.fetchCount(this)
  }

  // Emits the number of matching records, then emits a new count every time it changes
  // Note: By default, the Observable is throttled!
  observeCount(isThrottled: boolean = true): Observable<number> {
    return isThrottled ? this._cachedCountThrottledObservable : this._cachedCountObservable
  }

  experimentalSubscribeToCount(subscriber: number => void): () => void {
    // TODO: share underlying subscription
    return subscribeToCount(this, false, subscriber)
  }

  // Marks as deleted all records matching the query
  async markAllAsDeleted(): Promise<void> {
    const records = await this.fetch()
    await allPromises(record => record.markAsDeleted(), records)
  }

  // Destroys all records matching the query
  async destroyAllPermanently(): Promise<void> {
    const records = await this.fetch()
    await allPromises(record => record.destroyPermanently(), records)
  }

  // MARK: - Internals

  get modelClass(): Class<Record> {
    return this.collection.modelClass
  }

  get table(): TableName<Record> {
    return this.modelClass.table
  }

  get secondaryTables(): TableName<any>[] {
    return getSecondaryTables(this.description)
  }

  get allTables(): TableName<any>[] {
    return prepend(this.table, this.secondaryTables)
  }

  get associations(): AssociationArgs[] {
    return getAssociations(this.secondaryTables, this.modelClass.associations)
  }

  // `true` if query contains conditions on foreign tables
  get hasJoins(): boolean {
    return !!this.description.join.length
  }

  // Serialized version of Query (e.g. for sending to web worker)
  serialize(): SerializedQuery {
    const { table, description, associations } = this
    return { table, description, associations }
  }
}
