// @flow

import type { Descriptor } from '../../utils/common/makeDecorator'

// Defines a property whose value is evaluated the first time it is accessed
// For example:
//
// class X {
//   @lazy date = new Date()
// }
//
// `date` will be set to the current date not when constructed, but only when `xx.date` is called.
// All subsequent calls will return the same value

export default function lazy(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const { configurable, enumerable, initializer, value } = descriptor
  return {
    configurable,
    enumerable,
    get(): any {
      // This happens if someone accesses the
      // property directly on the prototype
      if (this === target) {
        return undefined
      }

      const returnValue = initializer ? initializer.call(this) : value

      // Next time this property is called, skip the decorator, and just return the precomputed value
      Object.defineProperty(this, key, {
        configurable,
        enumerable,
        writable: true,
        value: returnValue,
      })

      return returnValue
    },
    // TODO: What should be the behavior on set?
  }
}

// Implementation inspired by lazyInitialize from `core-decorators`
