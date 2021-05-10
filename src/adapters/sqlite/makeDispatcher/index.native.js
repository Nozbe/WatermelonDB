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
  'count',
  'batch',
  'batchJSON',
  'getDeletedRecords',
  'destroyDeletedRecords',
  'unsafeResetDatabase',
  'getLocal',
  'setLocal',
  'removeLocal',
  'unsafeLoadFromSync',
]

export const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  dbName: string,
): NativeDispatcher => {
  const jsiDb = type === 'jsi' && global.nativeWatermelonCreateAdapter(dbName)

  const methods = dispatcherMethods.map((methodName) => {
    // batchJSON is missing on Android
    if (!DatabaseBridge[(methodName: any)] || (methodName === 'batchJSON' && jsiDb)) {
      return [methodName, undefined]
    }

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

            // On Android, errors are returned, not thrown - see DatabaseInstallation.cpp
            if (value instanceof Error) {
              callback({ error: value })
            } else {
              callback({ value })
            }
          } catch (error) {
            callback({ error })
          }
          return
        }

        // $FlowFixMe
        const returnValue = DatabaseBridge[methodName](tag, ...otherArgs)
        fromPromise(returnValue, callback)
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
