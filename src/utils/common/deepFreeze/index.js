// @flow

import invariant from '../invariant'

// Deep-freezes an object, but DOES NOT handle cycles
export default function deepFreeze<T: Object>(object: T): T {
  invariant(object && typeof object === 'object', 'Invalid attempt to deepFreeze not-an-Object')

  Object.getOwnPropertyNames(object).forEach((name: string) => {
    const value = object[name]

    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  })

  return Object.freeze(object)
}
