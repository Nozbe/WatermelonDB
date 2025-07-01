import { defer, Observable } from '../__wmelonRxShim'

// Performs an action when Observable is subscribed to; analogous to `Observable.do`

export default function doOnSubscribe<T>(
  onSubscribe: () => void,
): (arg1: Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    defer(() => {
      onSubscribe()
      return source
    })
}
