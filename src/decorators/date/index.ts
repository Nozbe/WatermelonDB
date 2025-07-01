import makeDecorator from '../../utils/common/makeDecorator'
import { onLowMemory } from '../../utils/common/memory'
import { ColumnName } from '../../Schema'

import { ensureDecoratorUsedProperly } from '../common'

// Defines a model property representing a date
// Serializes dates to milisecond-precision Unix timestamps, and deserializes them to Date objects
// (but passes null values as-is)
// Pass the database column name as an argument
// Examples:
//   @date('reacted_at') reactedAt: Date

const cache = new Map<number, Date>()
onLowMemory(() => cache.clear())

const dateDecorator = makeDecorator(
  (columnName: ColumnName) => (target: any, key: string, descriptor: any) => {
    ensureDecoratorUsedProperly(columnName, target, key, descriptor)

    return {
      configurable: true,
      enumerable: true,
      get(): Date | null | undefined {
        const rawValue = this.asModel._getRaw(columnName)
        if (typeof rawValue === 'number') {
          const cached = cache.get(rawValue)
          if (cached) {
            return cached
          }
          const date = new Date(rawValue)
          cache.set(rawValue, date)
          return date
        }
        return null
      },
      set(date?: Date | null): undefined {
        const rawValue = date ? +new Date(date) : null
        if (rawValue && date) {
          cache.set(rawValue, new Date(date))
        }
        this.asModel._setRaw(columnName, rawValue)
      },
    }
  },
)

export default dateDecorator
