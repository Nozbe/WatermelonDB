// @flow

import { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged, throttleTime } from 'rxjs/operators'

import type Query from '../Query'
import type Model from '../Model'

let isThrottlingDisabled = false

export function experimentalDisableObserveCountThrottling(): void {
  isThrottlingDisabled = true
}

// Produces an observable version of a query count by re-querying the database
// when any change occurs in any of the relevant Stores.
//
// TODO: Potential optimizations:
// - increment/decrement counter using matchers on insert/delete

function observeCountThrottled<Record: Model>(query: Query<Record>): Observable<number> {
  const { collection } = query
  return collection.database.withChangesForTables(query.allTables).pipe(
    throttleTime(250),
    switchMap(() => collection.fetchCount(query)),
    distinctUntilChanged(),
  )
}

export default function observeCount<Record: Model>(
  query: Query<Record>,
  isThrottled: boolean,
): Observable<number> {
  if (isThrottled && !isThrottlingDisabled) {
    return observeCountThrottled(query)
  }

  const { collection } = query
  return Observable.create(observer => {
    let previousCount = -1
    function observeCountFetch(): void {
      collection.fetchCount(query).then(count => {
        const shouldEmit = count !== previousCount
        previousCount = count
        shouldEmit && observer.next(count)
      })
    }

    const unsubscribe = collection.database.experimentalSubscribe(
      query.allTables,
      observeCountFetch,
    )
    observeCountFetch()

    return unsubscribe
  })
}
