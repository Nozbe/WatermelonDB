// @flow

import { is } from 'utils/fp'
import invariant from 'utils/common/invariant'

// Throws if passed value if a Promise
// Otherwise, returns the passed value as-is.
//
// Use to ensure API users aren't passing async functions

export default function ensureSync<T>(value: T): T {
  invariant(!is(Promise, value), 'Unexpected Promise. Passed function should be synchronous.')

  return value
}
