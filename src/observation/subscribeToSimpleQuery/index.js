// @flow

import { logError } from '../../utils/common'
import { type Unsubscribe } from '../../utils/subscriptions'

import type Query from '../../Query'
import type Model from '../../Model'

import type { Matcher } from '../encodeMatcher'

export default function subscribeToSimpleQuery<Record: Model>(
  query: Query<Record>,
  subscriber: (Record[]) => void,
  // if true, emissions will always be made on collection change -- this is an internal hack needed by
  // observeQueryWithColumns
  alwaysEmit: boolean = false,
): Unsubscribe {
  let matcher: ?Matcher<Record> = null
  let unsubscribed = false
  let unsubscribe = null

  query.collection._fetchQuery(query, function observeQueryInitialEmission(result): void {
    if (unsubscribed) {
      return
    }

    if (result.error) {
      logError(result.error.toString())
      return
    }

    const initialRecords = result.value

    // Send initial matching records
    const matchingRecords: Record[] = initialRecords
    const emitCopy = () => !unsubscribed && subscriber(matchingRecords.slice(0))
    emitCopy()

    // Check if emitCopy haven't completed source observable to avoid memory leaks
    if (unsubscribed) {
      return
    }

    // Observe changes to the collection
    const debugInfo = { name: 'subscribeToSimpleQuery', query, subscriber }
    unsubscribe = query.collection.experimentalSubscribe(function observeQueryCollectionChanged(
      changeSet,
    ): void {
      if (!matcher) {
        matcher = require('../encodeMatcher').default(query.description)
      }
      // $FlowFixMe
      const shouldEmit = require('./processChangeSet').default(changeSet, matcher, matchingRecords)
      if (shouldEmit || alwaysEmit) {
        emitCopy()
      }
    },
    debugInfo)
  })

  return () => {
    unsubscribed = true
    unsubscribe && unsubscribe()
  }
}
