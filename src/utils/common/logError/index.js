// @flow

import diagnosticError from '../diagnosticError'
import logger from '../logger'

// Logs an Error to the console with the given message
//
// Use when a *recoverable* error occurs (so you don't want it to throw)

export default function logError(errorMessage: string): void {
  const error: any = diagnosticError(errorMessage)
  error.framesToPop += 1

  logger.error(error)
}
