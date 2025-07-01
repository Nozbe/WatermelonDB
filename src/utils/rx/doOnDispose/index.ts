import { Observable } from '../__wmelonRxShim'

// Performs an action when Observable is disposed; analogous to `Observable.do`

export default function doOnDispose<T>(
  onDispose: () => void,
): (arg1: Observable<T>) => Observable<T> {
  return (source: Observable<T>) =>
    Observable.create((observer: (arg1: T) => void) => {
      const subscription = source.subscribe(observer)
      return () => {
        subscription.unsubscribe()
        onDispose()
      }
    })
}
