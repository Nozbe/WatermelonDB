// @flow

import { Observable, switchMap, distinctUntilChanged, throttleTime } from '../../utils/rx'
import { logError } from '../../utils/common'
import { toPromise } from '../../utils/fp/Result'
import { type Unsubscribe } from '../../utils/subscriptions'

import type Query from '../../Query'
import type Model, { RecordId } from '../../Model'

export default function subscribeToIds<Record: Model>(
  query: Query<Record>,
  subscriber: (RecordId[]) => void,
): Unsubscribe {
  const { collection } = query

  let unsubscribed = false

  const observeIdsFetch = () => {
    collection._fetchIds(query, (result) => {
      if (result.error) {
        logError(result.error.toString())
        return
      }

      const shouldEmit = !unsubscribed
      shouldEmit && subscriber(result.value)
    })
  }

  const unsubscribe = collection.database.experimentalSubscribe(query.allTables, observeIdsFetch, {
    name: 'subscribeToIds',
    query,
    subscriber,
  })

  observeIdsFetch()

  return () => {
    unsubscribed = true
    unsubscribe()
  }
}
