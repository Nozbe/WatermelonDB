// @flow
/* eslint-disable global-require */

import { NativeModules } from 'react-native'
import { type ConnectionTag, logger, invariant } from '../../../utils/common'
import { fromPromise, type ResultCallback } from '../../../utils/fp/Result'
import type {
  DispatcherType,
  SQLiteAdapterOptions,
  SqliteDispatcher,
  SqliteDispatcherMethod,
} from '../type'

const { DatabaseBridge } = NativeModules

class SqliteNativeModulesDispatcher implements SqliteDispatcher {
  _tag: ConnectionTag

  constructor(tag: ConnectionTag): void {
    this._tag = tag
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        DatabaseBridge,
        `NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for more details`,
      )
    }
  }

  call(name: SqliteDispatcherMethod, _args: any[], callback: ResultCallback<any>): void {
    let methodName = name
    let args = _args
    if (methodName === 'batch' && DatabaseBridge.batchJSON) {
      methodName = 'batchJSON'
      args = [JSON.stringify(args[0])]
    }
    fromPromise(DatabaseBridge[methodName](this._tag, ...args), callback)
  }
}

class SqliteJsiDispatcher implements SqliteDispatcher {
  _db: any

  constructor(dbName: string): void {
    this._db = global.nativeWatermelonCreateAdapter(dbName)
  }

  call(methodName: SqliteDispatcherMethod, args: any[], callback: ResultCallback<any>): void {
    try {
      const result = this._db[methodName](...args)
      // On Android, errors are returned, not thrown - see DatabaseInstallation.cpp
      if (result instanceof Error) {
        callback({ error: result })
      } else {
        callback({ value: result })
      }
    } catch (error) {
      callback({ error })
    }
  }
}

export const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  dbName: string,
): SqliteDispatcher =>
  type === 'jsi' ? new SqliteJsiDispatcher(dbName) : new SqliteNativeModulesDispatcher(tag)

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
