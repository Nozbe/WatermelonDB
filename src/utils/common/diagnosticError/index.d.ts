export type DiagnosticErrorFunction = (string) => Error
// let customDiagnosticErrorFunction: DiagnosticErrorFunction | null

export function useCustomDiagnosticErrorFunction(
  diagnosticErrorFunction: DiagnosticErrorFunction,
): void

export default function diagnosticError(errorMessage: string): Error
