// @flow

import identicalArrays from '../../utils/fp/identicalArrays'
import { type Unsubscribe } from '../../utils/subscriptions'

import { type Value } from '../../QueryDescription'
import { type ColumnName } from '../../Schema'
import type Query from '../../Query'
import type { CollectionChangeSet } from '../../Collection'

import type Model, { RecordId } from '../../Model'
import subscribeToSimpleQuery from '../subscribeToSimpleQuery'
import subscribeToQueryReloading from '../subscribeToQueryReloading'
import canEncodeMatcher from '../encodeMatcher/canEncode'

type RecordState = Value[]

const getRecordState: (Model, ColumnName[]) => RecordState = (record, columnNames) => {
  const state = []
  const raw = record._raw
  for (let i = 0, len = columnNames.length; i < len; i++) {
    // $FlowFixMe
    state.push(raw[columnNames[i]])
  }
  return state
}

// Invariant: same length and order of keys!
const recordStatesEqual: (left: RecordState, right: RecordState) => boolean = identicalArrays

// Observes the given observable list of records, and in those records,
// changes to given `rawFields`
//
// Emits a list of records when:
// - source observable emits a new list
// - any of the records in the list has any of the given fields changed
//
// TODO: Possible future optimizations:
// - simpleObserver could emit added/removed events, and this could operate on those instead of
//   re-deriving the same thing. For reloadingObserver, a Rx adapter could be fitted
// - multiple levels of array copying could probably be omitted

export default function subscribeToQueryWithColumns<Record: Model>(
  query: Query<Record>,
  columnNames: ColumnName[],
  subscriber: (Record[]) => void,
): Unsubscribe {
  // State kept for comparison between emissions
  let unsubscribed = false
  let sourceIsFetching = true // do not emit record-level changes while source is fetching new data
  let hasPendingColumnChanges = false
  let firstEmission = true
  let observedRecords: Record[] = []
  const recordStates = new Map<RecordId, RecordState>()

  const emitCopy = (records: Array<Record>) => {
    !unsubscribed && subscriber(records.slice(0))
  }

  // NOTE:
  // Observing both the source subscription and changes to columns is very tricky
  // if we want to avoid unnecessary emissions (we do, because that triggers wasted app renders).
  // The compounding factor is that we have two methods of observation: simpleObserver which is
  // synchronous, and reloadingObserver, which is asynchronous.
  //
  // For reloadingObserver, we use `reloadingObserverWithStatus` to be notified that an async DB query
  // has begun. If it did, we will not emit column-only changes until query has come back.
  //
  // For simpleObserver, we need to configure it to always emit on collection changes. This is a
  // workaround to solve a race condition - collection observation for column check will always
  // emit first, but we don't know if the list of observed records isn't about to change, so we
  // flag, and wait for source response.
  //
  // FIXME: The above explanation is outdated in practice because modern WatermelonDB uses synchronous
  // adapters... However, JSI on Android isn't yet fully shipped (so this is currently broken), and
  // we may get back to some asynchronicity where appropriate...

  // prepare source observable
  // TODO: On one hand it would be nice to bring in the source logic to this function to optimize
  // on the other, it would be good to have source provided as Observable, not Query
  // so that we can reuse cached responses -- but they don't have compatible format
  const canUseSimpleObservation = canEncodeMatcher(query.description)
  const subscribeToSource = canUseSimpleObservation
    ? (observer: (recordsOrStatus: Array<Record>) => void) => subscribeToSimpleQuery(query, observer, true)
    : (observer) => subscribeToQueryReloading(query, observer, true)
  const asyncSource = !canUseSimpleObservation

  // Observe changes to records we have on the list
  const debugInfo = { name: 'subscribeToQueryWithColumns', query, columnNames }
  const collectionUnsubscribe = query.collection.experimentalSubscribe(
    function observeWithColumnsCollectionChanged(changeSet: CollectionChangeSet<Record>): void {
      let hasColumnChanges = false
      // Can't use `Array.some`, because then we'd skip saving record state for relevant records
      changeSet.forEach(({ record, type }) => {
        // See if change is relevant to our query
        if (type !== 'updated') {
          return
        }

        const previousState = recordStates.get(record.id)
        if (!previousState) {
          return
        }

        // Check if record changed one of its observed fields
        const newState = getRecordState(record, columnNames)
        if (!recordStatesEqual(previousState, newState)) {
          recordStates.set(record.id, newState)
          hasColumnChanges = true
        }
      })

      if (hasColumnChanges) {
        if (sourceIsFetching || !asyncSource) {
          // Mark change; will emit on source emission to avoid duplicate emissions
          hasPendingColumnChanges = true
        } else {
          emitCopy(observedRecords)
        }
      }
    },
    debugInfo,
  )

  // Observe the source records list (list of records matching a query)
  const sourceUnsubscribe = subscribeToSource(function observeWithColumnsSourceChanged(
    recordsOrStatus,
  ): void {
    // $FlowFixMe
    if (recordsOrStatus === false) {
      sourceIsFetching = true
      return
    }
    sourceIsFetching = false

    // Emit changes if one of observed columns changed OR list of matching records changed
    const records: Record[] = recordsOrStatus
    const shouldEmit =
      firstEmission || hasPendingColumnChanges || !identicalArrays(records, observedRecords)

    hasPendingColumnChanges = false
    firstEmission = false

    // Find changes, and save current list for comparison on next emission
    const arrayDifference = require('../../utils/fp/arrayDifference').default
    const { added, removed } = arrayDifference(observedRecords, records)
    observedRecords = records

    // Unsubscribe from records removed from list
    removed.forEach((record) => {
      recordStates.delete(record.id)
    })

    // Save current record state for later comparison
    added.forEach((newRecord) => {
      recordStates.set(newRecord.id, getRecordState(newRecord, columnNames))
    })

    // Emit
    shouldEmit && emitCopy(records)
  })

  return () => {
    unsubscribed = true
    sourceUnsubscribe()
    collectionUnsubscribe()
  }
}
