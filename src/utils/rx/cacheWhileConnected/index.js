// @flow

import type { Observable } from 'rxjs/Observable'
import { distinctUntilChanged } from 'rxjs/operators'
import publishReplayLatestWhileConnected from '../publishReplayLatestWhileConnected'

// Equivalent to observable |> distinctUntilChanged |> publishReplayLatestWhileConnected |> refCount
//
// Creates an observable that shares the connection with and replays the latest value from the underlying
// observable, and skips emissions that are the same as the previous one

export default function cacheWhileConnected<T>(source: Observable<T>): Observable<T> {
  return source
    .pipe(
      distinctUntilChanged(),
      publishReplayLatestWhileConnected,
    )
    .refCount()
}
