// @flow

import { Observable } from 'rxjs/Observable'
import { pickAll, values } from 'rambdax'

import identicalArrays from '../../utils/fp/identicalArrays'
import arrayDifference from '../../utils/fp/arrayDifference'

import { type Value } from '../../QueryDescription'
import { type ColumnName } from '../../Schema'
import type Collection from '../../Collection'

import type Model, { RecordId } from '../../Model'

type RecordState = { [field: ColumnName]: Value }

const getRecordState: (Model, ColumnName[]) => RecordState = (record, rawFields) =>
  // `pickAll` guarantees same length and order of keys!
  // $FlowFixMe
  pickAll(rawFields, record._raw)

// Invariant: same length and order of keys!
const recordStatesEqual = (left: RecordState, right: RecordState): boolean =>
  identicalArrays(values(left), values(right))

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

export default function fieldObserver<Record: Model>(
  sourceRecords: Observable<Record[]>,
  rawFields: ColumnName[],
  collection: Collection<Record>,
  asyncSource: boolean,
): Observable<Record[]> {
  return Observable.create(observer => {
    // State kept for comparison between emissions
    let sourceIsFetching = true // do not emit record-level changes while source is fetching new data
    let hasPendingColumnChanges = false
    let firstEmission = true
    let observedRecords: Record[] = []
    const recordStates = new Map<RecordId, RecordState>()

    const emitCopy = records => observer.next(records.slice(0))

    // Observe the source records list (list of records matching a query)
    const sourceSubscription = sourceRecords.subscribe(recordsOrStatus => {
      if (recordsOrStatus === false) {
        sourceIsFetching = true
        return
      }
      sourceIsFetching = false

      // Re-emit changes to the list
      const records: Record[] = recordsOrStatus

      // identicalArrays check is not needed with simpleObserver, as it won't emit if no changes
      // but it is necessary for rawReloadingObserver, that will
      if (firstEmission || hasPendingColumnChanges || !identicalArrays(records, observedRecords)) {
        emitCopy(records)
      }
      hasPendingColumnChanges = false
      firstEmission = false

      // Find changes, and save current list for comparison on next emission
      const { added, removed } = arrayDifference(observedRecords, records)
      observedRecords = records

      // Unsubscribe from records removed from list
      removed.forEach(record => {
        recordStates.delete(record.id)
      })

      // Save current record state for later comparison
      added.forEach(newRecord => {
        recordStates.set(newRecord.id, getRecordState(newRecord, rawFields))
      })
    })

    // Observe changes to records we have on the list
    const collectionSubscription = collection.changes.subscribe(changeSet => {
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
        const newState = getRecordState(record, rawFields)
        if (!recordStatesEqual(previousState, newState)) {
          recordStates.set(record.id, newState)
          hasColumnChanges = true
        }
      })

      if (hasColumnChanges) {
        if (sourceIsFetching || !asyncSource) {
          hasPendingColumnChanges = true
        } else {
          emitCopy(observedRecords)
        }
      }
    })

    return sourceSubscription.add(collectionSubscription)
  })
}
