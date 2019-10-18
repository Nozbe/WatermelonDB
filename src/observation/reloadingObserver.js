// @flow

import type { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged, startWith, filter as filter$ } from 'rxjs/operators'
import { from } from 'rxjs/observable/from'

import identicalArrays from '../utils/fp/identicalArrays'

import type Query from '../Query'
import type Model from '../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries

export function reloadingObserverWithStatus<Record: Model>(
  query: Query<Record>,
): Observable<Record[] | false> {
  const { database } = query.collection

  return database
    .withChangesForTables(query.allTables)
    .pipe(switchMap(() => from(query.collection.fetchQuery(query)).pipe(startWith(false))))
}

export default function reloadingObserver<Record: Model>(
  query: Query<Record>,
): Observable<Record[]> {
  return reloadingObserverWithStatus(query)
    .pipe(
      (filter$(value => value !== false): $FlowFixMe<
        (Observable<Record[] | false>) => Observable<Record[]>,>),
    )
    .pipe(distinctUntilChanged(identicalArrays))
}
