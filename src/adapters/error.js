// @flow
/* eslint-disable getter-return */

// Used as a placeholder during reset database to catch illegal
// adapter calls

const throwError = (name) => {
  throw new Error(`Cannot call database.adapter.${name} while the database is being reset`)
}

export default class ErrorAdapter {
  constructor(): void {
    ;[
      'find',
      'query',
      'count',
      'batch',
      'getDeletedRecords',
      'destroyDeletedRecords',
      'unsafeResetDatabase',
      'getLocal',
      'setLocal',
      'removeLocal',
      'unsafeSqlQuery',
      'testClone',
    ].forEach((name) => {
      // $FlowFixMe
      this[name] = () => throwError(name)
    })
  }

  get underlyingAdapter(): void {
    throwError('underlyingAdapter')
  }

  get schema(): void {
    throwError('schema')
  }

  get migrations(): void {
    throwError('migrations')
  }
}
