// @flow
/* eslint-disable global-require */

import { fromPairs } from '../../../utils/fp'
import DatabaseBridge from '../sqlite-node/DatabaseBridge'
import { type ConnectionTag } from '../../../utils/common'
import { fromPromise } from '../../../utils/fp/Result'
import type { DispatcherType, SQLiteAdapterOptions, NativeDispatcher } from '../type'

export { DatabaseBridge }

const dispatcherMethods = [
  'initialize',
  'setUpWithSchema',
  'setUpWithMigrations',
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
]

export const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  _dbName: string,
): NativeDispatcher => {
  const methods = dispatcherMethods.map((methodName) => {
    return [
      methodName,
      (...args) => {
        // $FlowFixMe
        const callback: (any) => void = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        const promise = new Promise((resolve, reject) => {
          // $FlowFixMe
          DatabaseBridge[methodName](tag, ...otherArgs, resolve, (code, message, error) => {
            reject(error)
          })
        })
        fromPromise(promise, callback)
      },
    ]
  })

  const dispatcher = fromPairs(methods)
  // $FlowFixMe
  return dispatcher
}

export function getDispatcherType(_options: SQLiteAdapterOptions): DispatcherType {
  return 'asynchronous'
}
