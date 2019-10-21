// @flow

import type { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged, startWith } from 'rxjs/operators'
import { from } from 'rxjs/observable/from'

import identicalArrays from '../utils/fp/identicalArrays'

import type Query from '../Query'
import type Model from '../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries

export default function reloadingObserver<Record: Model>(
  query: Query<Record>,
  // Emits `false` when query fetch begins + always emits even if no change - internal trick needed
  // by observeWithColumns
  shouldEmitStatus: boolean = false,
): Observable<Record[]> {
  const reloadingQuery = query.collection.database.withChangesForTables(query.allTables).pipe(
    switchMap(() => {
      const queryPromise = query.collection.fetchQuery(query)
      return shouldEmitStatus ? from(queryPromise).pipe(startWith((false: any))) : queryPromise
    }),
  )

  return shouldEmitStatus
    ? reloadingQuery
    : reloadingQuery.pipe(distinctUntilChanged(identicalArrays))
}
