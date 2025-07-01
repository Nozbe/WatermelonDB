import {prepend} from 'rambdax';

import allPromises from '../utils/fp/allPromises'
import { Observable } from '../utils/rx'
import { toPromise } from '../utils/fp/Result'
import { Unsubscribe, SharedSubscribable } from '../utils/subscriptions'
import { logger } from '../utils/common'

// TODO: ?
import lazy from '../decorators/lazy' // import from decorarators break the app on web production WTF ¯\_(ツ)_/¯

import subscribeToCount from '../observation/subscribeToCount'
import subscribeToQuery from '../observation/subscribeToQuery'
import subscribeToQueryWithColumns from '../observation/subscribeToQueryWithColumns'
import * as Q from '../QueryDescription'
import type { Clause, QueryDescription } from '../QueryDescription'
import type Model from '../Model'
import type { AssociationInfo } from '../Model'
import type Collection from '../Collection'
import type { TableName, ColumnName } from '../Schema'

import { getAssociations } from './helpers'

export type QueryAssociation = {
  from: TableName<any>;
  to: TableName<any>;
  info: AssociationInfo;
  joinedAs?: TableName<any>;
};

export type SerializedQuery = {
  table: TableName<any>;
  description: QueryDescription;
  associations: QueryAssociation[];
};

interface QueryCountProxy {
  then<U>(
    onFulfill?: (value: number) => Promise<U> | U,
    onReject?: (error?: any) => Promise<U> | U,
  ): Promise<U>;
}

export default class Query<Record extends Model> {
  collection: Collection<Record>;

  description: QueryDescription;

  _rawDescription: QueryDescription;

  // @ts-ignore
  @lazy
  _cachedSubscribable: SharedSubscribable<Record[]> = new SharedSubscribable(
    (subscriber: (arg1: Array<Record>) => void) => subscribeToQuery(this, subscriber),
  );

  // @ts-ignore
  @lazy
  _cachedCountSubscribable: SharedSubscribable<number> = new SharedSubscribable(
    (subscriber: (arg1: number) => void) => subscribeToCount(this, false, subscriber),
  );

  // @ts-ignore
  @lazy
  _cachedCountThrottledSubscribable: SharedSubscribable<number> = new SharedSubscribable(
    (subscriber: (arg1: number) => void) => subscribeToCount(this, true, subscriber),
  );

  // Note: Don't use this directly, use Collection.query(...)
  constructor(collection: Collection<Record>, clauses: Clause[]) {
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
      // todo add eagerJoinTables
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

  pipe<T>(transform: (arg1: this) => T): T {
    return transform(this)
  }

  // Queries database and returns an array of matching records
  fetch(): Promise<Record[]> {
    return toPromise(callback => this.collection._fetchQuery(this, callback))
  }

  then<U>(
    onFulfill?: (value: Record[]) => Promise<U> | U,
    onReject?: (error?: any) => Promise<U> | U,
  ): Promise<U> {
    return this.fetch().then(onFulfill, onReject);
  }

  // Emits an array of matching records, then emits a new array every time it changes
  observe(): Observable<Record[]> {
    return Observable.create((observer: any) =>
      this._cachedSubscribable.subscribe(records => {
        observer.next(records)
      }),
    )
  }

  // Same as `observe()` but also emits the list when any of the records
  // on the list has one of `columnNames` chaged
  observeWithColumns(columnNames: ColumnName[]): Observable<Record[]> {
    return Observable.create((observer: any) =>
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
        onReject?: (error?: any) => Promise<U> | U,
      ): Promise<U> {
        return model.fetchCount().then(onFulfill, onReject);
      },
    };
  }

  // Emits the number of matching records, then emits a new count every time it changes
  // Note: By default, the Observable is throttled!
  observeCount(isThrottled: boolean = true): Observable<number> {
    return Observable.create((observer: any) => {
      const subscribable = isThrottled
        ? this._cachedCountThrottledSubscribable
        : this._cachedCountSubscribable
      return subscribable.subscribe(count => {
        observer.next(count)
      })
    })
  }

  experimentalSubscribe(subscriber: (arg1: Record[]) => void): Unsubscribe {
    return this._cachedSubscribable.subscribe(subscriber)
  }

  experimentalSubscribeWithColumns(columnNames: ColumnName[], subscriber: (arg1: Record[]) => void): Unsubscribe {
    return subscribeToQueryWithColumns(this, columnNames, subscriber)
  }

  experimentalSubscribeToCount(subscriber: (arg1: number) => void): Unsubscribe {
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

  get modelClass(): any {
    return this.collection.modelClass
  }

  get table(): TableName<Record> {
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
