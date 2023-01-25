// @flow

import { type Decorator } from '../../utils/common/makeDecorator'

import { type ColumnName } from '../../Schema'
import type Model from '../../Model'

import { ensureDecoratorUsedProperly } from '../common'

// Defines a model property that's (de)serialized to and from JSON using custom sanitizer function.
//
// Pass the database column name as first argument, and sanitizer function as second.
//
// Stored value will be parsed to JSON if possible, and passed to sanitizer as argument, or
// undefined will be passed on parsing error. Field value will be result of sanitizer call.
//
// Value assigned to field will be passed to sanitizer and its results will be stored as stringified
// value.
//
// Examples:
//   @json('contact_info', jsonValue => jasonValue || {}) contactInfo: ContactInfo

const parseJSON = (value) => {
  // fast path
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  try {
    return JSON.parse(value)
  } catch (_) {
    return undefined
  }
}

const defaultOptions = { memo: false }

export const jsonDecorator: Decorator =
  (
    rawFieldName: ColumnName,
    sanitizer: (json: any, model?: Model) => any,
    options?: $Exact<{ memo?: boolean }> = defaultOptions,
  ) =>
  (target: Object, key: string, descriptor: Object) => {
    ensureDecoratorUsedProperly(rawFieldName, target, key, descriptor)

    return {
      configurable: true,
      enumerable: true,
      get(): any {
        // $FlowFixMe
        const model = this
        const rawValue = model.asModel._getRaw(rawFieldName)

        if (options.memo) {
          // Use cached value if possible
          model._jsonDecoratorCache = model._jsonDecoratorCache || {}
          const cachedEntry = model._jsonDecoratorCache[rawFieldName]
          if (cachedEntry && cachedEntry[0] === rawValue) {
            return cachedEntry[1]
          }
        }

        const parsedValue = parseJSON(rawValue)
        const sanitized = sanitizer(parsedValue, model)

        if (options.memo) {
          model._jsonDecoratorCache[rawFieldName] = [rawValue, sanitized]
        }

        return sanitized
      },
      set(json: any): void {
        // $FlowFixMe
        const model = this
        const sanitizedValue = sanitizer(json, model)
        const stringifiedValue = sanitizedValue != null ? JSON.stringify(sanitizedValue) : null

        model.asModel._setRaw(rawFieldName, stringifiedValue)
      },
    }
  }

export default jsonDecorator
