// @flow
/* eslint-disable global-require */

import { fromPairs } from 'rambdax'

import DatabaseBridge from './node/DatabaseBridge'

import { type ConnectionTag, logger } from '../../../utils/common'

import { fromPromise } from '../../../utils/fp/Result'

import type { DispatcherType, SQLiteAdapterOptions, NativeDispatcher } from '../type'

import { syncReturnToResult } from '../common'

export { DatabaseBridge }

const dispatcherMethods = [
  'initialize',
  'setUpWithSchema',
  'setUpWithMigrations',
  'find',
  'query',
  'count',
  'batch',
  'batchJSON',
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
  password: string,
): NativeDispatcher => {
  const methods = dispatcherMethods.map(methodName => {
    const name = type === 'synchronous' ? `${methodName}Synchronous` : methodName

    return [
      methodName,
      (...args) => {
        // $FlowFixMe
        const callback: any => void = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        if (type === 'synchronous') {
          // $FlowFixMe
          callback(syncReturnToResult(DatabaseBridge[name](tag, ...otherArgs)))
        } else {
          const promise = new Promise((resolve, reject) => {
            // $FlowFixMe
            DatabaseBridge[name](tag, ...otherArgs, resolve, (code, message, error) => {
              reject(error)
            })
          })
          fromPromise(promise, callback)
        }
      },
    ]
  })

  const dispatcher = fromPairs(methods)
  // $FlowFixMe
  return dispatcher
}

export function getDispatcherType(options: SQLiteAdapterOptions): DispatcherType {
  if (options.synchronous) {
    if (DatabaseBridge.initializeSynchronous) {
      return 'synchronous'
    }

    logger.warn(
      `Synchronous SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
    )
  }

  return 'asynchronous'
}
