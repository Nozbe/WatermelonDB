// @flow

import makeDecorator from '../../utils/common/makeDecorator'
import { type ColumnName } from '../../Schema'

import { ensureDecoratorUsedProperly } from '../common'

// Defines a model property representing a date
//
// Serializes dates to milisecond-precision Unix timestamps, and deserializes them to Date objects
// (but passes null values as-is)
//
// Pass the database column name as an argument
//
// Examples:
//   @date('reacted_at') reactedAt: Date

const dateDecorator = makeDecorator(
  (columnName: ColumnName) => (target: Object, key: string, descriptor: Object) => {
    ensureDecoratorUsedProperly(columnName, target, key, descriptor)

    return {
      configurable: true,
      enumerable: true,
      get(): ?Date {
        const rawValue = this._getRaw(columnName)
        return typeof rawValue === 'number' ? new Date(rawValue) : null
      },
      set(date: ?Date): void {
        const rawValue = date ? +new Date(date) : null
        this._setRaw(columnName, rawValue)
      },
    }
  },
)

export default dateDecorator
