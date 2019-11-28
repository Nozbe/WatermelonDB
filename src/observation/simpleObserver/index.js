// @flow

import { Observable } from 'rxjs/Observable'

import type { CollectionChangeSet } from '../../Collection'
import { CollectionChangeTypes } from '../../Collection/common'

import type Query from '../../Query'
import type Model from '../../Model'

import encodeMatcher, { type Matcher } from '../encodeMatcher'

// WARN: Mutates arguments
export function processChangeSet<Record: Model>(
  changeSet: CollectionChangeSet<Record>,
  matcher: Matcher<Record>,
  mutableMatchingRecords: Record[],
): boolean {
  let shouldEmit = false
  changeSet.forEach(change => {
    const { record, type } = change
    const index = mutableMatchingRecords.indexOf(record)
    const currentlyMatching = index > -1

    if (type === CollectionChangeTypes.destroyed) {
      if (currentlyMatching) {
        // Remove if record was deleted
        mutableMatchingRecords.splice(index, 1)
        shouldEmit = true
      }
      return
    }

    const matches = matcher(record._raw)

    if (currentlyMatching && !matches) {
      // Remove if doesn't match anymore
      mutableMatchingRecords.splice(index, 1)
      shouldEmit = true
    } else if (matches && !currentlyMatching) {
      // Add if should be included but isn't
      mutableMatchingRecords.push(record)
      shouldEmit = true
    }
  })
  return shouldEmit
}

export default function simpleObserver<Record: Model>(
  query: Query<Record>,
  // if true, emissions will always be made on collection change -- this is an internal hack needed by
  // observeQueryWithColumns
  alwaysEmit: boolean = false,
): Observable<Record[]> {
  // Note: it would be cleaner to do defer->switchMap, but that makes profiles really hard to read
  // hence the mutability
  return Observable.create(observer => {
    const matcher: Matcher<Record> = encodeMatcher(query.description)
    let unsubscribed = false
    let unsubscribe = null

    query.collection
      .fetchQuery(query)
      .then(function observeQueryInitialEmission(initialRecords): void {
        if (unsubscribed) {
          return
        }

        // Send initial matching records
        const matchingRecords: Record[] = initialRecords
        const emitCopy = () => observer.next(matchingRecords.slice(0))
        emitCopy()

        // Observe changes to the collection
        unsubscribe = query.collection.experimentalSubscribe(function observeQueryCollectionChanged(
          changeSet,
        ): void {
          const shouldEmit = processChangeSet(changeSet, matcher, matchingRecords)
          if (shouldEmit || alwaysEmit) {
            emitCopy()
          }
        })
      })

    return () => {
      unsubscribed = true
      unsubscribe && unsubscribe()
    }
  })
}
