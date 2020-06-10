// @flow

import escapeString from 'sql-escape-string'
import { logError } from '../../../utils/common'

import type { Value } from '../../../QueryDescription'

// Note: SQLite doesn't support literal TRUE and FALSE; expects 1 or 0 instead
// It also doesn't encode strings the same way
// Also: catches invalid values (undefined, NaN) early

export default function encodeValue(value: Value): string {
  if (value === true) {
    return '1'
  } else if (value === false) {
    return '0'
  } else if (Number.isNaN(value)) {
    logError('Passed NaN to query')
    return 'null'
  } else if (value === undefined) {
    logError('Passed undefined to query')
    return 'null'
  } else if (value === null) {
    return 'null'
  } else if (typeof value === 'number') {
    return `${value}`
  } else if (typeof value === 'string') {
    // TODO: We shouldn't ever encode SQL values directly — use placeholders
    return escapeString(value)
  }
  throw new Error('Invalid value to encode into query')
}
