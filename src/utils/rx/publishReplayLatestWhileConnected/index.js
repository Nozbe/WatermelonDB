// @flow

import { type ConnectableObservable, type Observable, ReplaySubject, multicast } from '../rx'

// Creates a Connectable observable, that, while connected, replays the latest emission
// upon subscription. When disconnected, the replay cache is cleared.

export default function publishReplayLatestWhileConnected<T>(
  source: Observable<T>,
): ConnectableObservable<T> {
  return source.pipe(multicast(() => new ReplaySubject(1)))
}
