// @flow

import { type Unsubscribe } from '../type'
import invariant from '../../common/invariant'

// A subscribable that implements the equivalent of:
// multicast(() => new ReplaySubject(1)) |> refCount Rx operation
//
// In other words:
// - Upon subscription, the source subscribable is subscribed to,
//   and its notifications are passed to subscribers here.
// - Multiple subscribers only cause a single subscription of the source
// - When last subscriber unsubscribes, the source is unsubscribed
// - Upon subscription, the subscriber receives last value sent by source (if any)
export default class SharedSubscribable<T> {
  _source: (subscriber: (T) => void) => Unsubscribe

  _unsubscribeSource: ?Unsubscribe = null

  _subscribers: [(T) => void, any][] = []

  _didEmit: boolean = false

  _lastValue: T = (null: any)

  constructor(source: (subscriber: (T) => void) => Unsubscribe): void {
    this._source = source
  }

  subscribe(subscriber: (T) => void, debugInfo?: any): Unsubscribe {
    const entry = [subscriber, debugInfo]
    this._subscribers.push(entry)

    if (this._didEmit) {
      subscriber(this._lastValue)
    }

    if (this._subscribers.length === 1) {
      // TODO: What if this throws?
      this._unsubscribeSource = this._source((value) => this._notify(value))
    }

    return () => this._unsubscribe(entry)
  }

  _notify(value: T): void {
    invariant(
      this._subscribers.length,
      `SharedSubscribable's source emitted a value after it was unsubscribed from`,
    )
    this._didEmit = true
    this._lastValue = value
    this._subscribers.forEach(([subscriber]) => {
      subscriber(value)
    })
  }

  _unsubscribe(entry: [(T) => void, any]): void {
    const idx = this._subscribers.indexOf(entry)
    idx !== -1 && this._subscribers.splice(idx, 1)

    if (!this._subscribers.length) {
      const unsubscribe = this._unsubscribeSource
      this._unsubscribeSource = null
      this._didEmit = false
      unsubscribe && unsubscribe()
    }
  }
}
