// @flow

import { isObj } from '../../utils/fp'
import { catchError, of } from '../../utils/rx'

type FailsafeDecorator = (
  fallback?: any,
) => (target: Object, key: string, descriptor: Object) => Object

const failsafe: FailsafeDecorator =
  (fallback = undefined) =>
  (target, key, descriptor) => {
    return {
      ...descriptor,
      get(): any {
        let value
        // $FlowFixMe[object-this-reference]
        const unsafeThis = this

        if ('value' in descriptor) {
          value = descriptor.value
        } else if ('get' in descriptor) {
          value = descriptor.get.call(unsafeThis)
        } else if ('initializer' in descriptor) {
          value = descriptor.initializer.call(unsafeThis)
        }

        if (value && isObj(value)) {
          const originalFetch = value.fetch
          const originalObserve = value.observe

          if (typeof originalFetch === 'function') {
            value.fetch = function fetch(...args): any {
              const result = originalFetch.apply(value, args)
              if (isObj(result) && typeof result.catch === 'function') {
                return result.catch(() => fallback)
              }
              return result
            }
          }

          if (typeof originalObserve === 'function') {
            value.observe = function observe(...args): any {
              const result = originalObserve.apply(value, args)
              if (isObj(result) && typeof result.pipe === 'function') {
                return result.pipe(catchError(() => of(fallback)))
              }
              return result
            }
          }
        }

        Object.defineProperty(unsafeThis, key, {
          value,
          enumerable: descriptor.enumerable,
        })

        return value
      },
    }
  }

export default failsafe
