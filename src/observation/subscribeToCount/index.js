// @flow

import { Observable } from 'rxjs/Observable'
import { switchMap, distinctUntilChanged, throttleTime } from 'rxjs/operators'

import type Query from '../../Query'
import type Model from '../../Model'

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

export default function subscribeToCount<Record: Model>(
  query: Query<Record>,
  isThrottled: boolean,
  subscriber: number => void,
): () => void {
  if (isThrottled && !isThrottlingDisabled) {
    const observable = observeCountThrottled(query)
    const subscription = observable.subscribe(count => subscriber(count))
    return () => subscription.unsubscribe()
  }

  const { collection } = query
  let unsubscribed = false

  let previousCount = -1
  const observeCountFetch = () => {
    collection.fetchCount(query).then(count => {
      const shouldEmit = count !== previousCount && !unsubscribed
      previousCount = count
      shouldEmit && subscriber(count)
    })
  }

  const unsubscribe = collection.database.experimentalSubscribe(query.allTables, observeCountFetch)
  observeCountFetch()

  return () => {
    unsubscribed = true
    unsubscribe()
  }
}
