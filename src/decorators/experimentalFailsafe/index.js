// @flow

import { isObj } from '../../utils/fp'
import { catchError, map, of } from '../../utils/rx'

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

          // A Relation can recover from a missing related record: when marked as failsafe, its
          // `observe()` emits `null` while the record does not exist (and the record once it
          // is created) instead of erroring — which, if caught below, would end the observation
          const isRelation = !!value.constructor && value.constructor._wmelonTag === 'relation'
          if (isRelation) {
            value._isFailsafe = true
          }

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
                const operators = [catchError(() => of(fallback))]
                if (isRelation) {
                  // Missing related record is emitted as `null` — map it to the fallback value
                  // (a relation whose ID is null legitimately emits `null`, so leave that alone)
                  operators.unshift(
                    map((record) => (record === null && value.id ? fallback : record)),
                  )
                }
                return result.pipe(...operators)
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
