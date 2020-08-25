// @flow

import { Observable, Subject, ReplaySubject, BehaviorSubject, of, merge, defer } from 'rxjs'

import {
  map,
  multicast,
  distinctUntilChanged,
  switchMap,
  throttleTime,
  startWith,
} from 'rxjs/operators'
import type { ConnectableObservable } from 'rxjs'

export {
  // classes
  Observable,
  Subject,
  ReplaySubject,
  BehaviorSubject,
  // observables
  of,
  merge,
  defer,
  // operators
  multicast,
  distinctUntilChanged,
  map,
  switchMap,
  throttleTime,
  startWith,
}
export type { ConnectableObservable }
