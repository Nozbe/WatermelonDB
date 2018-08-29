// @flow

import type { Observable } from 'rxjs/Observable'
import { defer } from 'rxjs/observable/defer'

// Performs an action when Observable is subscribed to; analogous to `Observable.do`

export default function doOnSubscribe<T>(
  onSubscribe: () => void
): (Observable<T>) => Observable<T> {
  return source =>
    defer(() => {
      onSubscribe()
      return source
    })
}
