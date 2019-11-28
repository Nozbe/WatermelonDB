// @flow

import type { Observable } from 'rxjs/Observable'

import type Query from '../Query'
import type Model from '../Model'

import reloadingObserver from './reloadingObserver'
import simpleObserver from './simpleObserver'

export default function observeQuery<Record: Model>(query: Query<Record>): Observable<Record[]> {
  return query.hasJoins ? reloadingObserver(query) : simpleObserver(query)
}
