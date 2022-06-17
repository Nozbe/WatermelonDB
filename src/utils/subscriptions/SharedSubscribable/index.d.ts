import { type Unsubscribe } from '../type'

export default class SharedSubscribable<T> {
  _source: (subscriber: (T) => void) => Unsubscribe

  _unsubscribeSource: Unsubscribe | null

  _subscribers: [(T) => void, any][]

  _didEmit: boolean

  _lastValue: T | null

  constructor(source: (subscriber: (T) => void) => Unsubscribe);

  subscribe(subscriber: (T) => void, debugInfo?: any): Unsubscribe;

  _notify(value: T): void

  _unsubscribe(entry: [(T) => void, any]): void
}
