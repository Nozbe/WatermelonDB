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

  constructor(dbName: string, usesExclusiveLocking: boolean): void {
    this._db = global.nativeWatermelonCreateAdapter(dbName, usesExclusiveLocking)
  }

  call(name: SqliteDispatcherMethod, _args: any[], callback: ResultCallback<any>): void {
    let methodName = name
    let args = _args

    if (methodName === 'query' && !global.HermesInternal) {
      // NOTE: compressing results of a query into a compact array makes querying 15-30% faster on JSC
      // but actually 9% slower on Hermes (presumably because Hermes has faster C++ JSI and slower JS execution)
      methodName = 'queryAsArray'
    } else if (methodName === 'batch') {
      methodName = 'batchJSON'
      args = [JSON.stringify(args[0])]
    } else if (methodName === 'provideSyncJson') {
      fromPromise(DatabaseBridge.provideSyncJson(...args), callback)
      return
    }

    try {
      let result = this._db[methodName](...args)
      // On Android, errors are returned, not thrown - see DatabaseInstallation.cpp
      if (result instanceof Error) {
        callback({ error: result })
      } else {
        if (methodName === 'queryAsArray') {
          result = require('./decodeQueryResult').default(result)
        }
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
  usesExclusiveLocking: boolean,
): SqliteDispatcher =>
  type === 'jsi'
    ? new SqliteJsiDispatcher(dbName, usesExclusiveLocking)
    : new SqliteNativeModulesDispatcher(tag)

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
