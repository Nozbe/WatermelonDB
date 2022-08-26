// @flow

import {
  type Observable,
  of as of$,
  map as map$,
  switchMap,
  distinctUntilChanged,
} from '../utils/rx'

import type Relation from './index'
import type Model from '../Model'

const getImmutableObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._model.collections
    .get(relation._relationTableName)
    // $FlowFixMe
    .findAndObserve(relation.id)

const getObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._model
    .observe()
    // $FlowFixMe
    .pipe(
      map$((model) => model._getRaw(relation._columnName)),
      distinctUntilChanged(),
      switchMap((id) =>
        id
          ? relation._model.collections.get(relation._relationTableName).findAndObserve(id)
          : of$(null),
      ),
    )

// eslint-disable-next-line
export const createObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._isImmutable ? getImmutableObservable(relation) : getObservable(relation)
