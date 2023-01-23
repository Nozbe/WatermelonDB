// @flow

import { $Keys, Array } from '../../../types'

export default function keys<T = {}>(obj: T): Array<$Keys<T>>
