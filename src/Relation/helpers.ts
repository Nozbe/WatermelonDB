import {Observable, of as of$, map as map$, switchMap, distinctUntilChanged} from '../utils/rx';

import type Relation from './index'
import type Model from '../Model'

const getImmutableObservable = (relation: Relation<any>): Observable<any> => relation._model.collections
  .get(relation._relationTableName)
  .findAndObserve(relation?.id as string)

const getObservable = <T extends Model | null | undefined>(relation: Relation<T>): Observable<T> => relation._model
  .observe()
  .pipe(
    map$(model => model._getRaw(relation._columnName)),
    distinctUntilChanged(),
    switchMap(id => {
      if (typeof id !== 'string' && typeof id !== 'number') {
        return of$(null) as Observable<T>;
      }
      return relation._model.collections
        .get(relation._relationTableName)
        .findAndObserve(String(id)) as Observable<NonNullable<T>>;
    }) as any, // Type assertion needed due to complex generic constraints
  )

// eslint-disable-next-line
export const createObservable = <T extends Model | null | undefined>(relation: Relation<T>): Observable<T> => relation._isImmutable ? getImmutableObservable(relation) : getObservable(relation)
