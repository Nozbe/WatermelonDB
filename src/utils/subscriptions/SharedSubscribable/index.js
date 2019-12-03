// @flow

import { type Unsubscribe } from '../type'

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

  _unsubscribe: ?Unsubscribe = null

  _subscribers: Array<(T) => void> = []

  _didEmit: boolean = false

  _lastValue: T = (null: any)

  constructor(source: (subscriber: (T) => void) => Unsubscribe): void {
    this._source = source
  }

  subscribe(subscriber: T => void): Unsubscribe {
    this._subscribers.push(subscriber)

    if (this._didEmit) {
      subscriber(this._lastValue)
    }

    if (this._subscribers.length === 1) {
      this._unsubscribe = this._source(value => this._notify(value))
    }

    return () => {
      const idx = this._subscribers.indexOf(subscriber)
      this._subscribers.splice(idx, 1)

      if (!this._subscribers.length) {
        const unsubscribe = this._unsubscribe
        this._unsubscribe = null
        this._didEmit = false
        unsubscribe && unsubscribe()
      }
    }
  }

  _notify(value: T): void {
    this._didEmit = true
    this._lastValue = value
    this._subscribers.forEach(subscriber => {
      subscriber(value)
    })
  }
}
