// @flow

import { Observable } from 'rxjs/Observable'

// Performs an action when Observable is disposed; analogous to `Observable.do`

export default function doOnDispose<T>(onDispose: () => void): (Observable<T>) => Observable<T> {
  return source =>
    Observable.create(observer => {
      const subscription = source.subscribe(observer)
      return () => {
        subscription.unsubscribe()
        onDispose()
      }
    })
}
