// @flow

import { defer, type Observable } from '../rx'

// Performs an action when Observable is subscribed to; analogous to `Observable.do`

export default function doOnSubscribe<T>(
  onSubscribe: () => void,
): (Observable<T>) => Observable<T> {
  return source =>
    defer(() => {
      onSubscribe()
      return source
    })
}
