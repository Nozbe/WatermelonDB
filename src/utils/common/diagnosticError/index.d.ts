export type DiagnosticErrorFunction = (_: string) => Error

export function useCustomDiagnosticErrorFunction(
  diagnosticErrorFunction: DiagnosticErrorFunction,
): void

export default function diagnosticError(errorMessage: string): Error
