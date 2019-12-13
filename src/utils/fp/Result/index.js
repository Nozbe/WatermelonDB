// @flow

export type Result<T> = $Exact<{ value: T }> | $Exact<{ error: Error }>
