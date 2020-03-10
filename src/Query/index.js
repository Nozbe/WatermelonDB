// @flow

import { Observable } from 'rxjs/Observable'
import { prepend } from 'rambdax'

import allPromises from '../utils/fp/allPromises'
import { toPromise } from '../utils/fp/Result'
import { type Unsubscribe, SharedSubscribable } from '../utils/subscriptions'

// TODO: ?
import lazy from '../decorators/lazy' // import from decorarators break the app on web production WTF ¯\_(ツ)_/¯

import subscribeToCount from '../observation/subscribeToCount'
import subscribeToQuery from '../observation/subscribeToQuery'
import subscribeToQueryWithColumns from '../observation/subscribeToQueryWithColumns'
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

export default class Query<Record: Model> {
  collection: Collection<Record>

  description: QueryDescription

  _rawDescription: QueryDescription

  @lazy
  _cachedSubscribable: SharedSubscribable<Record[]> = new SharedSubscribable(subscriber =>
    subscribeToQuery(this, subscriber),
  )

  @lazy
  _cachedCountSubscribable: SharedSubscribable<number> = new SharedSubscribable(subscriber =>
    subscribeToCount(this, false, subscriber),
  )

  @lazy
  _cachedCountThrottledSubscribable: SharedSubscribable<number> = new SharedSubscribable(
    subscriber => subscribeToCount(this, true, subscriber),
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
    return toPromise(callback => this.collection._fetchQuery(this, callback))
  }

  // Emits an array of matching records, then emits a new array every time it changes
  observe(): Observable<Record[]> {
    return Observable.create(observer =>
      this._cachedSubscribable.subscribe(records => {
        observer.next(records)
      }),
    )
  }

  // Same as `observe()` but also emits the list when any of the records
  // on the list has one of `columnNames` chaged
  observeWithColumns(columnNames: ColumnName[]): Observable<Record[]> {
    return Observable.create(observer =>
      this.experimentalSubscribeWithColumns(columnNames, records => {
        observer.next(records)
      }),
    )
  }

  // Returns the number of matching records
  fetchCount(): Promise<number> {
    return toPromise(callback => this.collection._fetchCount(this, callback))
  }

  // Emits the number of matching records, then emits a new count every time it changes
  // Note: By default, the Observable is throttled!
  observeCount(isThrottled: boolean = true): Observable<number> {
    return Observable.create(observer => {
      const subscribable = isThrottled
        ? this._cachedCountThrottledSubscribable
        : this._cachedCountSubscribable
      return subscribable.subscribe(count => {
        observer.next(count)
      })
    })
  }

  experimentalSubscribe(subscriber: (Record[]) => void): Unsubscribe {
    return this._cachedSubscribable.subscribe(subscriber)
  }

  experimentalSubscribeWithColumns(
    columnNames: ColumnName[],
    subscriber: (Record[]) => void,
  ): Unsubscribe {
    return subscribeToQueryWithColumns(this, columnNames, subscriber)
  }

  experimentalSubscribeToCount(subscriber: number => void): Unsubscribe {
    return this._cachedCountSubscribable.subscribe(subscriber)
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
