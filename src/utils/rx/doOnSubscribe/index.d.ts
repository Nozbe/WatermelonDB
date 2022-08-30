// @flow

import { defer, type Observable } from '../__wmelonRxShim'

// Performs an action when Observable is subscribed to; analogous to `Observable.do`

export default function doOnSubscribe<T>(
  onSubscribe: () => void,
): (observable: Observable<T>) => Observable<T>