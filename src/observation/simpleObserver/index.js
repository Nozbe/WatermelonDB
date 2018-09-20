// @flow

import { Observable } from 'rxjs/Observable'
import { defer } from 'rxjs/observable/defer'
import { switchMap } from 'rxjs/operators'

import doOnDispose from 'utils/rx/doOnDispose'
import doOnSubscribe from 'utils/rx/doOnSubscribe'

import logger from 'utils/common/logger'
import { CollectionChangeTypes } from 'Collection'

import type Query from 'Query'
import type Model from 'Model'

import encodeMatcher, { type Matcher } from '../encodeMatcher'

function observeChanges<Record: Model>(query: Query<Record>): (Record[]) => Observable<Record[]> {
  const matcher: Matcher<Record> = encodeMatcher(query.description)

  return initialRecords =>
    Observable.create(observer => {
      // Send initial matching records
      const matchingRecords: Record[] = initialRecords
      const emit = () => observer.next(matchingRecords.slice(0))
      emit()

      // Observe changes to the collection
      return query.collection.changes.subscribe(changes => {
        changes.forEach(change => {
          const { record, type } = change
          const index = matchingRecords.indexOf(record)
          const currentlyMatching = index > -1

          if (currentlyMatching && type === CollectionChangeTypes.destroyed) {
            // Remove if record was deleted
            matchingRecords.splice(index, 1)
            return
          }

          const matches = matcher(record)

          if (currentlyMatching && !matches) {
            // Remove if doesn't match anymore
            matchingRecords.splice(index, 1)
          } else if (matches && !currentlyMatching) {
            // Add if should be included but isn't
            matchingRecords.push(record)
          }
        })
        emit()
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
