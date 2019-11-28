// @flow

import identicalArrays from '../../utils/fp/identicalArrays'

import type Query from '../../Query'
import type Model from '../../Model'

// Produces an observable version of a query by re-querying the database
// when any change occurs in any of the relevant Stores.
// This is inefficient for simple queries, but necessary for complex queries

export default function subscribeToQueryReloading<Record: Model>(
  query: Query<Record>,
  subscriber: (Record[]) => void,
  // Emits `false` when query fetch begins + always emits even if no change - internal trick needed
  // by observeWithColumns
  shouldEmitStatus: boolean = false,
): () => void {
  const { collection } = query
  let previousRecords: ?(Record[]) = null
  let unsubscribed = false

  function reloadingObserverFetch(): void {
    if (shouldEmitStatus) {
      subscriber((false: any))
    }

    collection.fetchQuery(query).then(records => {
      const shouldEmit =
        (shouldEmitStatus || !previousRecords || !identicalArrays(records, previousRecords)) &&
        !unsubscribed
      previousRecords = records
      shouldEmit && subscriber(records)
    })
  }

  const unsubscribe = collection.database.experimentalSubscribe(
    query.allTables,
    reloadingObserverFetch,
  )
  reloadingObserverFetch()

  return () => {
    unsubscribed = true
    unsubscribe()
  }
}
