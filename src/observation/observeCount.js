// @flow

import type { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged, throttleTime } from 'rxjs/operators'

import type Query from '../Query'
import type Model from '../Model'

// Produces an observable version of a query count by re-querying the database
// when any change occurs in any of the relevant Stores.
//
// TODO: Potential optimizations:
// - increment/decrement counter using matchers on insert/delete

export default function observeCount<Record: Model>(
  query: Query<Record>,
  isThrottled: boolean,
): Observable<number> {
  const { database } = query.collection
  const changes = database.withChangesForTables(query.allTables)
  const a = false
  const throttledChanges = a ? changes.pipe(throttleTime(250)) : changes

  return throttledChanges.pipe(
    switchMap(() => query.collection.fetchCount(query)),
    distinctUntilChanged(),
  )
}
