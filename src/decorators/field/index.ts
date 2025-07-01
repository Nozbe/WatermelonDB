import makeDecorator from '../../utils/common/makeDecorator'

import { Value } from '../../QueryDescription'
import { ColumnName } from '../../Schema'

import { ensureDecoratorUsedProperly } from '../common'

// Defines a model property
// Returns and sets values as-is, except that `undefined` and missing fields are normalized to `null`
// If you have a more specific propety, use the correct decorator (@boolean, @text, etc.)
// Pass the database column name as an argument
// Example:
//   @field('some_field') someField

const field = makeDecorator(
  (columnName: ColumnName) => (target: any, key: string, descriptor: any) => {
    ensureDecoratorUsedProperly(columnName, target, key, descriptor)

    return {
      configurable: true,
      enumerable: true,
      get(): Value {
        return this.asModel._getRaw(columnName)
      },
      set(value: any): undefined {
        this.asModel._setRaw(columnName, value)
      },
    }
  },
)

export default field
