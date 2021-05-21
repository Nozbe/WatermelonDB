// @flow
/* eslint-disable global-require */

import { NativeModules } from 'react-native'
import { fromPairs } from '../../../utils/fp'
import { type ConnectionTag, logger } from '../../../utils/common'
import { fromPromise } from '../../../utils/fp/Result'
import type {
  DispatcherType,
  SQLiteAdapterOptions,
  NativeDispatcher,
  NativeBridgeType,
} from '../type'

const { DatabaseBridge }: { DatabaseBridge: NativeBridgeType } = NativeModules

export { DatabaseBridge }

const dispatcherMethods = [
  'initialize',
  'setUpWithSchema',
  'setUpWithMigrations',
  'find',
  'query',
  'queryIds',
  'count',
  'batch',
  'batchJSON',
  'unsafeResetDatabase',
  'getLocal',
]

export const makeDispatcherNativeModules = (tag: ConnectionTag): NativeDispatcher => {
  const methods = dispatcherMethods.map((methodName) => {
    if (!DatabaseBridge[methodName]) {
      return [methodName, undefined]
    }

    return [
      methodName,
      (...args) => {
        const callback = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        // $FlowFixMe
        const returnValue = DatabaseBridge[methodName](tag, ...otherArgs)
        fromPromise(returnValue, callback)
      },
    ]
  })

  return (fromPairs(methods): any)
}

export const makeDispatcherJsi = (dbName: string): NativeDispatcher => {
  const jsiDb = global.nativeWatermelonCreateAdapter(dbName)

  const methods = dispatcherMethods.map((methodName) => {
    if (!jsiDb[methodName]) {
      return [methodName, undefined]
    }

    return [
      methodName,
      (...args) => {
        const callback = args[args.length - 1]
        const otherArgs = args.slice(0, -1)

        try {
          const value = jsiDb[methodName](...otherArgs)

          // On Android, errors are returned, not thrown - see DatabaseInstallation.cpp
          if (value instanceof Error) {
            callback({ error: value })
          } else {
            callback({ value })
          }
        } catch (error) {
          callback({ error })
        }
      },
    ]
  })

  return (fromPairs(methods): any)
}

export const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  dbName: string,
): NativeDispatcher =>
  type === 'jsi' ? makeDispatcherJsi(dbName) : makeDispatcherNativeModules(tag)

const initializeJSI = () => {
  if (global.nativeWatermelonCreateAdapter) {
    return true
  }

  if (DatabaseBridge.initializeJSI) {
    try {
      DatabaseBridge.initializeJSI()
      return !!global.nativeWatermelonCreateAdapter
    } catch (e) {
      logger.error('[SQLite] Failed to initialize JSI')
      logger.error(e)
    }
  }

  return false
}

export function getDispatcherType(options: SQLiteAdapterOptions): DispatcherType {
  if (options.jsi) {
    if (initializeJSI()) {
      return 'jsi'
    }

    logger.warn(
      `JSI SQLiteAdapter not available… falling back to asynchronous operation. This will happen if you're using remote debugger, and may happen if you forgot to recompile native app after WatermelonDB update`,
    )
  }

  return 'asynchronous'
}
