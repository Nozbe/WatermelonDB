// @flow

import { mapObj } from '../utils/fp'
import type { DirtyRaw } from '../RawRecord'

// beginning, end, length
export const censorValue = (value: string): string =>
  `${value.slice(0, 2)}***${value.slice(-2)}(${value.length})`

const shouldCensorKey = (key: string): boolean =>
  key !== 'id' && !key.endsWith('_id') && key !== '_status' && key !== '_changed'

// $FlowFixMe
const censorRaw: (DirtyRaw) => DirtyRaw = mapObj((value, key) =>
  shouldCensorKey(key) && typeof value === 'string' ? censorValue(value) : value,
)

export default censorRaw
