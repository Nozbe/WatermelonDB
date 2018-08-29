// @flow

import type { ConnectableObservable } from 'rxjs'
import { type Observable } from 'rxjs/Observable'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { multicast } from 'rxjs/operators'

// Creates a Connectable observable, that, while connected, replays the latest emission
// upon subscription. When disconnected, the replay cache is cleared.

export default function publishReplayLatestWhileConnected<T>(
  source: Observable<T>,
): ConnectableObservable<T> {
  return source.pipe(multicast(() => new ReplaySubject(1)))
}
