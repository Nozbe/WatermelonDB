// @flow

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
} from './__wmelonRxShim'
export type { ConnectableObservable } from './__wmelonRxShim'
