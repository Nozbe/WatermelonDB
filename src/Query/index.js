// @flow

import { prepend } from 'rambdax'

import allPromises from '../utils/fp/allPromises'
import { Observable } from '../utils/rx'
import { toPromise } from '../utils/fp/Result'
import { type Unsubscribe, SharedSubscribable } from '../utils/subscriptions'
import { logger } from '../utils/common'

// TODO: ?
import lazy from '../decorators/lazy' // import from decorarators break the app on web production WTF ¯\_(ツ)_/¯

import subscribeToCount from '../observation/subscribeToCount'
import subscribeToQuery from '../observation/subscribeToQuery'
import subscribeToQueryWithColumns from '../observation/subscribeToQueryWithColumns'
import * as Q from '../QueryDescription'
import type { Clause, QueryDescription } from '../QueryDescription'
import type Model, { AssociationInfo } from '../Model'
import type Collection from '../Collection'
import type { TableName, ColumnName } from '../Schema'

import { getAssociations } from './helpers'

export type QueryAssociation = $Exact<{
  from: TableName<any>,
  to: TableName<any>,
  info: AssociationInfo,
}>

export type SerializedQuery = $Exact<{
  table: TableName<any>,
  description: QueryDescription,
  associations: QueryAssociation[],
}>

interface QueryCountProxy {
  then<U>(
    onFulfill?: (value: number) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U>;
}

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
  constructor(collection: Collection<Record>, clauses: Clause[]): void {
    this.collection = collection
    this._rawDescription = Q.buildQueryDescription(clauses)
    this.description = Q.queryWithoutDeleted(this._rawDescription)
  }

  // Creates a new Query that extends the clauses of this query
  extend(...clauses: Clause[]): Query<Record> {
    const { collection } = this
    const {
      where,
      sortBy,
      take,
      skip,
      joinTables,
      nestedJoinTables,
      lokiFilter,
    } = this._rawDescription

    return new Query(collection, [
      Q.experimentalJoinTables(joinTables),
      ...nestedJoinTables.map(({ from, to }) => Q.experimentalNestedJoin(from, to)),
      ...where,
      ...sortBy,
      ...(take ? [Q.experimentalTake(take)] : []),
      ...(skip ? [Q.experimentalSkip(skip)] : []),
      ...(lokiFilter ? [Q.unsafeLokiFilter(lokiFilter)] : []),
      ...clauses,
    ])
  }

  pipe<T>(transform: this => T): T {
    return transform(this)
  }

  // Queries database and returns an array of matching records
  fetch(): Promise<Record[]> {
    return toPromise(callback => this.collection._fetchQuery(this, callback))
  }

  then<U>(
    onFulfill?: (value: Record[]) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U> {
    // $FlowFixMe
    return this.fetch().then(onFulfill, onReject)
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

  get count(): QueryCountProxy {
    const model = this
    return {
      then<U>(
        onFulfill?: (value: number) => Promise<U> | U,
        onReject?: (error: any) => Promise<U> | U,
      ): Promise<U> {
        // $FlowFixMe
        return model.fetchCount().then(onFulfill, onReject)
      },
    }
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
    // $FlowFixMe
    return this.modelClass.table
  }

  get secondaryTables(): TableName<any>[] {
    return this.description.joinTables.concat(this.description.nestedJoinTables.map(({ to }) => to))
  }

  get allTables(): TableName<any>[] {
    return prepend(this.table, this.secondaryTables)
  }

  get associations(): QueryAssociation[] {
    return getAssociations(this.description, this.modelClass, this.collection.db)
  }

  // `true` if query contains join clauses on foreign tables
  get hasJoins(): boolean {
    logger.warn('DEPRECATION: Query.hasJoins is deprecated')
    return !!this.secondaryTables.length
  }

  // Serialized version of Query (e.g. for sending to web worker)
  serialize(): SerializedQuery {
    const { table, description, associations } = this
    return { table, description, associations }
  }
}
