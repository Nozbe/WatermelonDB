// @flow

import diagnosticError from '../diagnosticError'

// If `condition` is falsy, throws an Error with the passed message

export default function invariant(condition: any, errorMessage?: string): void {
  if (!condition) {
    const error: any = diagnosticError(errorMessage || 'Broken invariant')
    error.framesToPop += 1
    throw error
  }
}
