// @flow

import invariant from '../invariant'

// Throws if passed value if a Promise
// Otherwise, returns the passed value as-is.
//
// Use to ensure API users aren't passing async functions

export default function ensureSync<T>(value: T): T {
  invariant(!(value instanceof Promise), 'Unexpected Promise. Passed function should be synchronous.')

  return value
}
