// @flow

import allPromises from '../utils/fp/allPromises'
import invariant from '../utils/common/invariant'
import { Observable } from '../utils/rx'
import { toPromise } from '../utils/fp/Result'
import { type Unsubscribe, SharedSubscribable } from '../utils/subscriptions'

// import from decorarators break the app on web production WTF ¯\_(ツ)_/¯
import lazy from '../decorators/lazy'

import subscribeToCount from '../observation/subscribeToCount'
import subscribeToQuery from '../observation/subscribeToQuery'
import subscribeToQueryWithColumns from '../observation/subscribeToQueryWithColumns'
import * as Q from '../QueryDescription'
import type { Clause, QueryDescription } from '../QueryDescription'
import type Model, { AssociationInfo, RecordId } from '../Model'
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
  // Used by withObservables to differentiate between object types
  static _wmelonTag: string = 'query'

  /**
   * Collection associated with this query
   */
  collection: Collection<Record>

  // TODO: Should this be public API? QueryDescription structure changes quite a bit...
  description: QueryDescription

  _rawDescription: QueryDescription

  @lazy
  _cachedSubscribable: SharedSubscribable<Record[]> = new SharedSubscribable((subscriber) =>
    subscribeToQuery(this, subscriber),
  )

  @lazy
  _cachedCountSubscribable: SharedSubscribable<number> = new SharedSubscribable((subscriber) =>
    subscribeToCount(this, false, subscriber),
  )

  @lazy
  _cachedCountThrottledSubscribable: SharedSubscribable<number> = new SharedSubscribable(
    (subscriber) => subscribeToCount(this, true, subscriber),
  )

  // Note: Don't use this directly, use Collection.query(...)
  constructor(collection: Collection<Record>, clauses: Clause[]): void {
    this.collection = collection
    this._rawDescription = Q.buildQueryDescription(clauses)
    this.description = Q.queryWithoutDeleted(this._rawDescription)
  }

  /**
   * Returns a new Query that contains all clauses (conditions, sorting, etc.) from this Query
   * as well as the ones passed as arguments.
   */
  extend(...clauses: Clause[]): // eslint-disable-next-line no-use-before-define
  Query<Record> {
    const { collection } = this
    const { where, sortBy, take, skip, joinTables, nestedJoinTables, lokiTransform, sql } =
      this._rawDescription

    invariant(!sql, 'Cannot extend an unsafe SQL query')

    // TODO: Move this & tests to QueryDescription
    return new Query(collection, [
      Q.experimentalJoinTables(joinTables),
      ...nestedJoinTables.map(({ from, to }) => Q.experimentalNestedJoin(from, to)),
      ...where,
      ...sortBy,
      ...(take ? [Q.take(take)] : []),
      ...(skip ? [Q.skip(skip)] : []),
      ...(lokiTransform ? [Q.unsafeLokiTransform(lokiTransform)] : []),
      ...clauses,
    ])
  }

  /**
   * `query.pipe(fn)` is a FP convenience for `fn(query)`
   */
  pipe<T>(transform: (this) => T): T {
    return transform(this)
  }

  /**
   * Fetches the list of records matching this query
   *
   * Tip: For convenience, you can also use `await query`
   */
  fetch(): Promise<Record[]> {
    return toPromise((callback) => this.collection._fetchQuery(this, callback))
  }

  then<U>(
    onFulfill?: (value: Record[]) => Promise<U> | U,
    onReject?: (error: any) => Promise<U> | U,
  ): Promise<U> {
    // $FlowFixMe
    return this.fetch().then(onFulfill, onReject)
  }

  /**
   * Returns an `Rx.Observable` that tracks the list of records matching this query
   *
   * Tip: When using `withObservables`, you can simply pass the query without calling `.observe()`
   *
   * Warning: Changes to individual records in the array are NOT observed. Use `observeWithColumns`
   */
  observe(): Observable<Record[]> {
    return Observable.create((observer) =>
      this._cachedSubscribable.subscribe((records) => {
        observer.next(records)
      }),
    )
  }

  /**
   * Same as {@link Query#observe}, but also emits when any of the records on the list
   * has one of its `columnNames` changed.
   */
  observeWithColumns(columnNames: ColumnName[]): Observable<Record[]> {
    return Observable.create((observer) =>
      this.experimentalSubscribeWithColumns(columnNames, (records) => {
        observer.next(records)
      }),
    )
  }

  /**
   * Fetches the number of records matching this query
   *
   * Tip: For convenience you can also use `await query.count`
   */
  fetchCount(): Promise<number> {
    return toPromise((callback) => this.collection._fetchCount(this, callback))
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

  /**
   * Returns an `Rx.Observable` that tracks the number of matching records
   *
   * Note: By default, the count is throttled. Pass `false` to opt out of throttling.
   */
  observeCount(isThrottled: boolean = true): Observable<number> {
    return Observable.create((observer) => {
      const subscribable = isThrottled
        ? this._cachedCountThrottledSubscribable
        : this._cachedCountSubscribable
      return subscribable.subscribe((count) => {
        observer.next(count)
      })
    })
  }

  /**
   * Fetches the list of IDs of records matching this query
   *
   * Note: This is faster than using `fetch()` if you only need IDs
   */
  fetchIds(): Promise<RecordId[]> {
    return toPromise((callback) => this.collection._fetchIds(this, callback))
  }

  /**
   * Fetches an array of raw results of this query from the database.
   * These are plain JavaScript types and objects, not `Model` instances
   *
   * Warning: You MUST NOT mutate these objects, this can corrupt the database!
   *
   * This is useful as a performance optimization or for running non-standard raw queries
   * (e.g. pragmas, statistics, groupped results, records with extra columns, etc...)
   */
  unsafeFetchRaw(): Promise<any[]> {
    return toPromise((callback) => this.collection._unsafeFetchRaw(this, callback))
  }

  /**
   * Rx-free equivalent of `.observe()`
   */
  experimentalSubscribe(subscriber: (Record[]) => void): Unsubscribe {
    return this._cachedSubscribable.subscribe(subscriber)
  }

  /**
   * Rx-free equivalent of `.observeWithColumns()`
   */
  experimentalSubscribeWithColumns(
    columnNames: ColumnName[],
    subscriber: (Record[]) => void,
  ): Unsubscribe {
    return subscribeToQueryWithColumns(this, columnNames, subscriber)
  }

  /**
   * Rx-free equivalent of `.observeCount()`
   */
  experimentalSubscribeToCount(subscriber: (number) => void): Unsubscribe {
    return this._cachedCountSubscribable.subscribe(subscriber)
  }

  /**
   * Marks all records matching this query as deleted (they will be deleted permenantly after sync)
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   *
   * @see {Model#markAsDeleted}
   */
  async markAllAsDeleted(): Promise<void> {
    const records = await this.fetch()
    await allPromises((record) => record.markAsDeleted(), records)
  }

  /**
   * Permanently deletes all records matching this query
   *
   * Note: Do not use this when using Sync, as deletion will not be synced.
   *
   * Note: This method must be called within a Writer {@link Database#write}.
   *
   * @see {Model#destroyPermanently}
   */
  async destroyAllPermanently(): Promise<void> {
    const records = await this.fetch()
    await allPromises((record) => record.destroyPermanently(), records)
  }

  // MARK: - Internals

  /**
   * `Model` subclass associated with this query
   */
  get modelClass(): Class<Record> {
    return this.collection.modelClass
  }

  /**
   * Table name of the Collection associated with this query
   */
  get table(): TableName<Record> {
    // $FlowFixMe
    return this.modelClass.table
  }

  // TODO: Should any of the below be public API? Is this any useful outside of Watermelon
  // internals? If so, should it even be here, not `_`-prefixed?
  get secondaryTables(): TableName<any>[] {
    return this.description.joinTables.concat(this.description.nestedJoinTables.map(({ to }) => to))
  }

  get allTables(): TableName<any>[] {
    return [this.table].concat(this.secondaryTables)
  }

  get associations(): QueryAssociation[] {
    return getAssociations(this.description, this.modelClass, this.collection.db)
  }

  // Serialized version of Query (e.g. for sending to web worker)
  serialize(): SerializedQuery {
    const { table, description, associations } = this
    return { table, description, associations }
  }
}
