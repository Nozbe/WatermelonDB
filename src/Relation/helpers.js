// @flow

import { Observable } from 'rxjs/Observable'
import { of as of$ } from 'rxjs/observable/of'
import { map as map$, switchMap, distinctUntilChanged } from 'rxjs/operators'

import type Relation from './index'
import type Model from '../Model'

const getImmutableObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._model.collections
    .get(relation._relationTableName)
    // $FlowFixMe
    .findAndObserve(relation.id)

const getObservable = <T: ?Model>(relation: Relation<T>): Observable<T> => {
  return Observable.create(observer => {
    const { _model: model, _columnName: columnName } = relation
    let relatedId = model._getRaw(columnName)

    let relationSubscription = null
    const relationStartObservation = () => {
      relationSubscription && relationSubscription()
      if (relatedId) {
        relationSubscription = model.collections
          .get(relation._relationTableName)
          .findAndSubscribe(relatedId, m2 => {
            observer.next(m2)
          })
      } else {
        observer.next(null)
      }
    }
    relationStartObservation()

    const modelSubscription = model.subscribeToChanges(() => {
      const oldId = relatedId
      relatedId = model._getRaw(columnName)
      if (relatedId !== oldId) {
        relationStartObservation()
      }
    })

    return () => {
      modelSubscription()
      relationSubscription && relationSubscription()
    }
  })
}
// relation._model
//   .observe()
//   // $FlowFixMe
//   .pipe(
//     map$(model => model._getRaw(relation._columnName)),
//     distinctUntilChanged(),
//     switchMap(
//       id =>
//         id ?
//           relation._model.collections.get(relation._relationTableName).findAndObserve(id) :
//           of$(null),
//     ),
//   )

// eslint-disable-next-line
export const createObservable = <T: ?Model>(relation: Relation<T>): Observable<T> =>
  relation._isImmutable ? getImmutableObservable(relation) : getObservable(relation)
