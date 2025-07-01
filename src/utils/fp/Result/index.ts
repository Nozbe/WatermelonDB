// lightweight type-only Result (Success(T) | Error) monad
export type Result<T> =
  | {
      value: T
    }
  | {
      error: Error
    }

export type ResultCallback<T> = (arg1: Result<T>) => void

export function toPromise<T>(withCallback: (arg1: ResultCallback<T>) => void): Promise<T> {
  return new Promise((resolve: (result: Promise<T> | T) => void, reject: (error?: any) => void) => {
    withCallback(result => {
      if ((result as any).error) {
        reject((result as any).error)
      }

      resolve((result as any).value)
    })
  })
}

export function fromPromise<T>(promise: Promise<T>, callback: ResultCallback<T>): void {
  promise.then(value => callback({ value }), error => callback({ error }))
}

export function mapValue<T, U>(mapper: (arg1: T) => U, result: Result<T>): Result<U> {
  if ((result as any).error) {
    return result as Result<U>
  }

  try {
    return { value: mapper((result as any).value) }
  } catch (error) {
    return { error: error as Error }
  }
}
