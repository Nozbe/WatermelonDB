// @flow

// lightweight type-only Result (Success(T) | Error) monad
export type Result<T> = $Exact<{ value: T }> | $Exact<{ error: Error }>

export type ResultCallback<T> = (Result<T>) => void

export function toPromise<T>(withCallback: (ResultCallback<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    withCallback(result => {
      if (result.error) {
        reject(result.error)
      }

      // $FlowFixMe - yes, you do have a value
      resolve(result.value)
    })
  })
}

export function fromPromise<T>(promise: Promise<T>, callback: ResultCallback<T>): void {
  promise.then(
    value => callback({ value }),
    error => callback({ error }),
  )
}

export function mapValue<T, U>(mapper: T => U, result: Result<T>): Result<U> {
  if (result.error) {
    return result
  }

  try {
    return { value: mapper(result.value) }
  } catch (error) {
    return { error }
  }
}
