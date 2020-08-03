// @flow

import type { SyncReturn } from './type'
import type { Result } from '../../utils/fp/Result'

export function syncReturnToResult<T>(syncReturn: SyncReturn<T>): Result<T> {
  if (syncReturn.status === 'success') {
    return { value: syncReturn.result }
  } else if (syncReturn.status === 'error') {
    const error = new Error(syncReturn.message)
    // $FlowFixMem
    error.code = syncReturn.code
    return { error }
  }

  return { error: new Error('Unknown native bridge response') }
}
