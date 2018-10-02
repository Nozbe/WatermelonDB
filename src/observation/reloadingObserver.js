// @flow

import type { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged } from 'rxjs/operators'

import identicalArrays from '../utils/fp/identicalArrays'

import type Query from '../Query'
import type Model from '../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries

export default function reloadingObserver<Record: Model>(
  query: Query<Record>,
): Observable<Record[]> {
  const { database } = query.collection

  return database
    .withChangesForTables(query.allTables)
    .pipe(switchMap(() => query.collection.fetchQuery(query)))
    .pipe(distinctUntilChanged(identicalArrays))
}
