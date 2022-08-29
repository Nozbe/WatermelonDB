// @flow

export { default as cacheWhileConnected } from './cacheWhileConnected'
// export { default as doOnDispose } from './doOnDispose'
// export { default as doOnSubscribe } from './doOnSubscribe'
export { default as publishReplayLatestWhileConnected } from './publishReplayLatestWhileConnected'

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
