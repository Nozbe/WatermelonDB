// @flow

import type { Subscription } from 'rxjs'
import { Observable } from 'rxjs/Observable'
import { skip as skip$ } from 'rxjs/operators'
import { pipe, pickAll, values, forEach } from 'rambdax'

import identicalArrays from '../../utils/fp/identicalArrays'
import arrayDifference from '../../utils/fp/arrayDifference'

import { type Value } from '../../QueryDescription'
import { type ColumnName } from '../../Schema'

import type Model, { RecordId } from '../../Model'

type RecordState = { [field: ColumnName]: Value }
type RecordStates = { [id: RecordId]: RecordState }
type Subscriptions = { [id: RecordId]: Subscription }

const getRecordState: (Model, ColumnName[]) => RecordState = (record, rawFields) =>
  // `pickAll` guarantees same length and order of keys!
  // $FlowFixMe
  pickAll(rawFields, record._raw)

// Invariant: same length and order of keys!
const recordStatesEqual = (left: RecordState, right: RecordState): boolean =>
  identicalArrays(values(left), values(right))

const unsubscribeAll: Subscriptions => * = pipe(
  values,
  forEach(subscription => subscription.unsubscribe()),
)

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
): Observable<Record[]> {
  return Observable.create(observer => {
    // State kept for comparison between emissions
    let observedRecords: Record[] = []
    const recordStates: RecordStates = {}
    const subscriptions: Subscriptions = {}

    const emitCopy = records => observer.next(records.slice(0))

    // Observe the list of records matching the record
    const sourceSubscription = sourceRecords.subscribe(records => {
      // Re-emit changes to the list
      emitCopy(records)

      // Find changes, and save current list for comparison on next emission
      const { added, removed } = arrayDifference(observedRecords, records)
      observedRecords = records

      // Unsubscribe from records removed from list
      removed.forEach(record => {
        subscriptions[record.id].unsubscribe()
        delete subscriptions[record.id]
        delete recordStates[record.id]
      })

      // Subscribe to newly added records
      added.forEach(newRecord => {
        // Save current record state for later comparison
        recordStates[newRecord.id] = getRecordState(newRecord, rawFields)

        // Skip the initial emission (only check for changes)
        subscriptions[newRecord.id] = newRecord
          .observe()
          .pipe(skip$(1))
          .subscribe(record => {
            // Check if there are any relevant changes to the record
            const previousState = recordStates[record.id]
            const newState = getRecordState(record, rawFields)

            // Save current state even if there are no relevant changes
            // (because there might be irrelevant diffs like false->0 that obscure debugging)
            recordStates[record.id] = newState

            if (!recordStatesEqual(previousState, newState)) {
              emitCopy(observedRecords)
            }
          })
      })
    })

    // Dispose of record subscriptions on disposal of this observable
    return sourceSubscription.add(() => {
      unsubscribeAll(subscriptions)
    })
  })
}
