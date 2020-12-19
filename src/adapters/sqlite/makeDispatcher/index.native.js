// @flow
/* eslint-disable global-require */

import { NativeModules } from 'react-native'
import { fromPairs } from 'rambdax'

import { type ConnectionTag, logger, invariant } from '../../../utils/common'

import { fromPromise } from '../../../utils/fp/Result'

import type {
  DispatcherType,
  SQLiteAdapterOptions,
  NativeDispatcher,
  NativeBridgeType,
} from '../type'

import { syncReturnToResult } from '../common'

const { DatabaseBridge }: { DatabaseBridge: NativeBridgeType } = NativeModules

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
  dbName: string,
  password: string,
): NativeDispatcher => {
  const jsiDb = type === 'jsi' && global.nativeWatermelonCreateAdapter(dbName)

  const methods = dispatcherMethods.map(methodName => {
    // batchJSON is missing on Android
    if (!DatabaseBridge[methodName] || (methodName === 'batchJSON' && jsiDb)) {
      return [methodName, undefined]
    }

    const name = type === 'synchronous' ? `${methodName}Synchronous` : methodName

    return [
      methodName,
      (...args) => {
        const callback = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        if (jsiDb) {
          try {
            const value =
              methodName === 'query' || methodName === 'count'
                ? jsiDb[methodName](...otherArgs, []) // FIXME: temp workaround
                : jsiDb[methodName](...otherArgs)
            callback({ value })
          } catch (error) {
            callback({ error })
          }
          return
        }

        // $FlowFixMe
        const returnValue = DatabaseBridge[name](tag, ...otherArgs)

        if (type === 'synchronous') {
          callback(syncReturnToResult((returnValue: any)))
        } else {
          fromPromise(returnValue, callback)
        }
      },
    ]
  })

  const dispatcher: any = fromPairs(methods)
  return dispatcher
}

const initializeJSI = () => {
  if (global.nativeWatermelonCreateAdapter) {
    return true
  }

  if (DatabaseBridge.initializeJSI) {
    try {
      DatabaseBridge.initializeJSI()
      return !!global.nativeWatermelonCreateAdapter
    } catch (e) {
      logger.error('[WatermelonDB][SQLite] Failed to initialize JSI')
      logger.error(e)
    }
  }

  return false
}

export function getDispatcherType(options: SQLiteAdapterOptions): DispatcherType {
  invariant(
    !(options.synchronous && options.experimentalUseJSI),
    '`synchronous` and `experimentalUseJSI` SQLiteAdapter options are mutually exclusive',
  )

  if (options.synchronous) {
    if (DatabaseBridge.initializeSynchronous) {
      return 'synchronous'
    }

    logger.warn(
      `Synchronous SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
    )
  } else if (options.experimentalUseJSI) {
    if (initializeJSI()) {
      return 'jsi'
    }

    logger.warn(
      `JSI SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
    )
  }

  return 'asynchronous'
}
