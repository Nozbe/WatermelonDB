// @flow

import { logError } from '../../utils/common'
import identicalArrays from '../../utils/fp/identicalArrays'
import { type Unsubscribe } from '../../utils/subscriptions'

import type Query from '../../Query'
import type Model, { RecordId } from '../../Model'

export default function subscribeToIds<Record: Model>(
  query: Query<Record>,
  subscriber: (RecordId[]) => void,
): Unsubscribe {
  const { collection } = query

  let previousRecordIds: ?(RecordId[]) = null
  let unsubscribed = false

  const observeIdsFetch = () => {
    collection._fetchIds(query, (result) => {
      if (result.error) {
        logError(result.error.toString())
        return
      }

      const recordIds = result.value

      const shouldEmit =
        !unsubscribed && (!previousRecordIds || !identicalArrays(recordIds, previousRecordIds))

      previousRecordIds = recordIds
      shouldEmit && subscriber(recordIds)
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
