// @flow

import is from '../utils/fp/is'
import invariant from '../utils/common/invariant'

import type { ColumnName } from '../Schema'

// eslint-disable-next-line
export function ensureDecoratorUsedProperly(
  columnName: ColumnName,
  target: Object,
  key: string,
  descriptor: Object,
): void {
  invariant(
    columnName,
    `Pass column name (raw field name) to the decorator - error in ${
      target.constructor.name
    }.prototype.${key} given.`,
  )
  if (descriptor) {
    invariant(
      'initializer' in descriptor,
      `Model field decorators can only be used for simple properties - method, setter or getter ${
        target.constructor.name
      }.prototype.${key} given.`,
    )
    invariant(
      !is(Function, descriptor.initializer),
      `Model field decorators must not be used on properties with a default value - error in "${
        target.constructor.name
      }.prototype.${key}".`,
    )
  }
}
