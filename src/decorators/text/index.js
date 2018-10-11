// @flow

import makeDecorator from '../../utils/common/makeDecorator'

import { ensureDecoratorUsedProperly } from '../common'

import { type ColumnName } from '../../Schema'

// Defines a model property representing user-input text
//
// On set, all strings are trimmed (whitespace is removed from beginning/end)
// and all non-string values are converted to strings
// (Except null which is passed as-is)
//
// Pass the database column name as an argument
//
// Examples:
//   @text(Column.name) name: string
//   @text('full_description') fullDescription: string

const text = makeDecorator(
  (columnName: ColumnName) => (target: Object, key: string, descriptor: Object) => {
    ensureDecoratorUsedProperly(columnName, target, key, descriptor)

    return {
      configurable: true,
      enumerable: true,
      get(): ?string {
        return this._getRaw(columnName)
      },
      set(value: ?string): void {
        this._setRaw(columnName, typeof value === 'string' ? value.trim() : null)
      },
    }
  },
)

export default text
