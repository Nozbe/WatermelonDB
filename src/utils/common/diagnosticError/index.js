// @flow

export type DiagnosticErrorFunction = string => Error
let customDiagnosticErrorFunction: ?DiagnosticErrorFunction = null

// Use this to replace default diagnosticError function to inject your custom logic
// (e.g. only display errors in development, or log errors to external service)
export function useCustomDiagnosticErrorFunction(
  diagnosticErrorFunction: DiagnosticErrorFunction,
): void {
  customDiagnosticErrorFunction = diagnosticErrorFunction
}

export default function diagnosticError(errorMessage: string): Error {
  if (customDiagnosticErrorFunction) {
    return customDiagnosticErrorFunction(errorMessage)
  }

  const error: any = new Error(errorMessage)

  // hides `diagnosticError` from RN stack trace
  error.framesToPop = 1
  error.name = 'Diagnostic error'

  return error
}
