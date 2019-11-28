// @flow

import { Observable } from 'rxjs/Observable'

import identicalArrays from '../../utils/fp/identicalArrays'

import type Query from '../../Query'
import type Model from '../../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries

export default function reloadingObserver<Record: Model>(
  query: Query<Record>,
  // Emits `false` when query fetch begins + always emits even if no change - internal trick needed
  // by observeWithColumns
  shouldEmitStatus: boolean = false,
): Observable<Record[]> {
  const { collection } = query
  return Observable.create(observer => {
    let previousRecords: ?(Record[]) = null
    function reloadingObserverFetch(): void {
      if (shouldEmitStatus) {
        observer.next((false: any))
      }

      collection.fetchQuery(query).then(records => {
        const shouldEmit =
          shouldEmitStatus || !previousRecords || !identicalArrays(records, previousRecords)
        previousRecords = records
        shouldEmit && observer.next(records)
      })
    }

    const unsubscribe = collection.database.experimentalSubscribe(
      query.allTables,
      reloadingObserverFetch,
    )
    reloadingObserverFetch()

    return unsubscribe
  })
}
