// @flow

import type { Observable } from 'rxjs/Observable'
import { ifElse, prop } from 'rambdax'

import type Query from 'Query'
import type Model from 'Model'

import reloadingObserver from './reloadingObserver'
import simpleObserver from './simpleObserver'

// $FlowFixMe
const observeQuery: <Record: Model>(Query<Record>) => Observable<Record[]> = ifElse(
  prop('hasJoins'),
  reloadingObserver,
  simpleObserver
)

export default observeQuery
