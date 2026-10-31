// @flow

import {
  type Observable,
  of as of$,
  map as map$,
  switchMap,
  distinctUntilChanged,
} from '../utils/rx'

import type Relation from './index'
import type Model, { RecordId } from '../Model'

// Failsafe relations emit `null` (and keep observing) instead of erroring when the related
// record does not exist, so that they recover when the record is created later
const observeRecord = <T: ?Model>(relation: Relation<T>, id: ?RecordId): Observable<T> => {
  const collection = relation._model.collections.get(relation._relationTableName)
  if (relation._isFailsafe) {
    // $FlowFixMe
    return id ? collection.observeRecord(id) : of$(null)
  }
  // $FlowFixMe
  return collection.findAndObserve(id)
}

const getImmutableObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  // $FlowFixMe
  observeRecord(relation, relation.id)

const getObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._model
    .observe()
    // $FlowFixMe
    .pipe(
      map$((model) => model._getRaw(relation._columnName)),
      distinctUntilChanged(),
      switchMap((id) => (id ? observeRecord(relation, id) : of$(null))),
    )

// eslint-disable-next-line
export const createObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._isImmutable ? getImmutableObservable(relation) : getObservable(relation)
