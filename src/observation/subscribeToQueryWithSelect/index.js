// @flow

import { propEq } from 'rambdax'
import { invariant, logError } from '../../utils/common'
import { type Unsubscribe } from '../../utils/subscriptions'

import type { CollectionChangeSet } from '../../Collection'
import { CollectionChangeTypes } from '../../Collection/common'

import type Query from '../../Query'
import type Model from '../../Model'
import { type RecordState, getRecordState, recordStatesEqual } from '../../RawRecord'
import { type ColumnName } from '../../Schema'

import encodeMatcher, { type Matcher } from '../encodeMatcher'
import { getSelectedColumns } from '../../QueryDescription'

// WARN: Mutates arguments
export function processChangeSet<Record: Model>(
  changeSet: CollectionChangeSet<Record>,
  columnNames: ColumnName[],
  matcher: Matcher<Record>,
  mutableMatchingRecords: RecordState[],
): boolean {
  let shouldEmit = false
  changeSet.forEach(change => {
    const { record, type } = change
    const index = mutableMatchingRecords.findIndex(propEq('id', record.id))
    const currentlyMatching = index > -1

    if (type === CollectionChangeTypes.destroyed) {
      if (currentlyMatching) {
        // Remove if record was deleted
        mutableMatchingRecords.splice(index, 1)
        shouldEmit = true
      }
      return
    }

    if(type === CollectionChangeTypes.updated) {
      if(currentlyMatching) {
        const prevState = mutableMatchingRecords[index]
        const newState = getRecordState(record._raw, columnNames)
        if(!recordStatesEqual(prevState, newState)) {
          mutableMatchingRecords[index] = newState
          shouldEmit = true
        }
      }
    }

    const matches = matcher(record._raw)

    if (currentlyMatching && !matches) {
      // Remove if doesn't match anymore
      mutableMatchingRecords.splice(index, 1)
      shouldEmit = true
    } else if (matches && !currentlyMatching) {
      // Add if should be included but isn't
      const _record = getRecordState(record._raw, columnNames)
      mutableMatchingRecords.push(_record)
      shouldEmit = true
    }
  })
  return shouldEmit
}

export default function subscribeToQueryWithSelect<Record: Model>(
  query: Query<Record>,
  subscriber: (RecordState[]) => void,
): Unsubscribe {
  invariant(!query.hasJoins, 'subscribeToQueryWithSelect only supports simple queries!')

  const matcher: Matcher<Record> = encodeMatcher(query.description)
  let unsubscribed = false
  let unsubscribe = null

  const columnNames = getSelectedColumns(query.description)

  query.collection._fetchQuerySelect(query, function observeQueryInitialEmission(result): void {
    if (unsubscribed) {
      return
    }

    if (!result.value) {
      logError(result.error.toString())
      return
    }

    const initialRecords = result.value

    // Send initial matching records
    const matchingRecords: RecordState[] = initialRecords
    const emitCopy = () => subscriber(matchingRecords.slice(0))
    emitCopy()

    // Check if emitCopy haven't completed source observable to avoid memory leaks
    if (unsubscribed) {
      return
    }

    // Observe changes to the collection
    unsubscribe = query.collection.experimentalSubscribe(function observeQueryCollectionChanged(
      changeSet,
    ): void {
      const shouldEmit = processChangeSet(changeSet, columnNames, matcher, matchingRecords)
      if (shouldEmit) {
        emitCopy()
      }
    })
  })

  return () => {
    unsubscribed = true
    unsubscribe && unsubscribe()
  }
}
