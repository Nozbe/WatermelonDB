// @flow

import { Observable } from '../__wmelonRxShim'

// Performs an action when Observable is disposed; analogous to `Observable.do`

export default function doOnDispose<T>(
  onDispose: () => void,
): (observable: Observable<T>) => Observable<T>
