// @flow

import { Observable } from 'rxjs/Observable'
import { defer } from 'rxjs/observable/defer'
import { switchMap } from 'rxjs/operators'

import doOnDispose from '../../utils/rx/doOnDispose'
import doOnSubscribe from '../../utils/rx/doOnSubscribe'

import logger from '../../utils/common/logger'
import type { CollectionChangeSet } from '../../Collection'
import { CollectionChangeTypes } from '../../Collection/common'

import type Query from '../../Query'
import type Model from '../../Model'

import encodeMatcher, { type Matcher } from '../encodeMatcher'

function processChangeSet<Record: Model>(
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

function observeChanges<Record: Model>(query: Query<Record>): (Record[]) => Observable<Record[]> {
  const matcher: Matcher<Record> = encodeMatcher(query.description)

  return initialRecords =>
    Observable.create(observer => {
      // Send initial matching records
      const matchingRecords: Record[] = initialRecords
      const emit = () => observer.next(matchingRecords.slice(0))
      emit()

      // Observe changes to the collection
      return query.collection.changes.subscribe(changeSet => {
        if (processChangeSet(changeSet, matcher, matchingRecords)) {
          emit()
        }
      })
    })
}

export default function simpleObserver<Record: Model>(query: Query<Record>): Observable<Record[]> {
  return defer(() => query.collection.fetchQuery(query)).pipe(
    switchMap(observeChanges(query)),
    doOnSubscribe(() => logger.log(`Subscribed to changes in a ${query.table} query`)),
    doOnDispose(() => logger.log(`Unsubscribed from changes in a ${query.table} query`)),
  )
}
