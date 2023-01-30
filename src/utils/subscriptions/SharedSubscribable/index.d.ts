import type { Unsubscribe } from '../type'

export default class SharedSubscribable<T> {
  _source: (subscriber: (_: T) => void) => Unsubscribe

  _unsubscribeSource: Unsubscribe | null

  _subscribers: [(_: T) => void, any][]

  _didEmit: boolean

  _lastValue: T | null

  constructor(source: (subscriber: (_: T) => void) => Unsubscribe)

  subscribe(subscriber: (_: T) => void, debugInfo?: any): Unsubscribe

  _notify(value: T): void

  _unsubscribe(entry: [(_: T) => void, any]): void
}
