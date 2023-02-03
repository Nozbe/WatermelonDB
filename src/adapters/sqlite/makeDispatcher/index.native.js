// @flow
/* eslint-disable global-require */

import { NativeModules, Platform } from 'react-native'
import { type ConnectionTag, logger, invariant } from '../../../utils/common'
import { fromPromise, type ResultCallback } from '../../../utils/fp/Result'
import type {
  DispatcherType,
  SQLiteAdapterOptions,
  SqliteDispatcher,
  SqliteDispatcherMethod,
  SqliteDispatcherOptions,
} from '../type'

const { DatabaseBridge, WMDatabaseBridge } = NativeModules

// TODO: Remove this after we're sure that new bridge works well
const USE_NEW_BRIDGE_FOR_JSI_SUPPORT = true

class SqliteNativeModulesDispatcher implements SqliteDispatcher {
  _tag: ConnectionTag
  _unsafeNativeReuse: boolean

  constructor(
    tag: ConnectionTag,
    { experimentalUnsafeNativeReuse }: SqliteDispatcherOptions,
  ): void {
    this._tag = tag
    this._unsafeNativeReuse = experimentalUnsafeNativeReuse
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        DatabaseBridge,
        `NativeModules.DatabaseBridge is not defined! This means that you haven't properly linked WatermelonDB native module. Refer to docs for instructions about installation (and the changelog if this happened after an upgrade).`,
      )
    }
  }

  call(name: SqliteDispatcherMethod, _args: any[], callback: ResultCallback<any>): void {
    let methodName: string = name
    let args = _args
    if (methodName === 'batch' && DatabaseBridge.batchJSON) {
      methodName = 'batchJSON'
      args = [JSON.stringify(args[0])]
    } else if (
      ['initialize', 'setUpWithSchema', 'setUpWithMigrations'].includes(methodName) &&
      Platform.OS === 'android'
    ) {
      // FIXME: Hacky, refactor once native reuse isn't an "unsafe experimental" option
      args.push(this._unsafeNativeReuse)
    }
    fromPromise(DatabaseBridge[methodName](this._tag, ...args), callback)
  }
}

class SqliteJsiDispatcher implements SqliteDispatcher {
  _db: any
  _unsafeErrorListener: (Error) => void // debug hook for NT use

  constructor(dbName: string, { usesExclusiveLocking }: SqliteDispatcherOptions): void {
    this._db = global.nativeWatermelonCreateAdapter(dbName, usesExclusiveLocking)
    this._unsafeErrorListener = () => {}
  }

  call(name: SqliteDispatcherMethod, _args: any[], callback: ResultCallback<any>): void {
    let methodName: string = name
    let args = _args

    if (methodName === 'query' && !global.HermesInternal) {
      // NOTE: compressing results of a query into a compact array makes querying 15-30% faster on JSC
      // but actually 9% slower on Hermes (presumably because Hermes has faster C++ JSI and slower JS execution)
      methodName = 'queryAsArray'
    } else if (methodName === 'batch') {
      methodName = 'batchJSON'
      args = [JSON.stringify(args[0])]
    } else if (methodName === 'provideSyncJson') {
      fromPromise(
        (USE_NEW_BRIDGE_FOR_JSI_SUPPORT ? WMDatabaseBridge : DatabaseBridge).provideSyncJson(
          ...args,
        ),
        callback,
      )
      return
    }

    try {
      const method = this._db[methodName]
      if (!method) {
        throw new Error(
          `Cannot run database method ${method} because database failed to open. ${Object.keys(
            this._db,
          ).join(',')}`,
        )
      }
      let result = method(...args)
      // On Android, errors are returned, not thrown - see DatabaseBridge.cpp
      if (result instanceof Error) {
        throw result
      } else {
        if (methodName === 'queryAsArray') {
          result = require('./decodeQueryResult').default(result)
        }
        callback({ value: result })
      }
    } catch (error) {
      this._unsafeErrorListener(error)
      callback({ error })
    }
  }
}

export const makeDispatcher = (
  type: DispatcherType,
  tag: ConnectionTag,
  dbName: string,
  options: SqliteDispatcherOptions,
): SqliteDispatcher =>
  type === 'jsi'
    ? new SqliteJsiDispatcher(dbName, options)
    : new SqliteNativeModulesDispatcher(tag, options)

const initializeJSI = () => {
  if (global.nativeWatermelonCreateAdapter) {
    return true
  }

  const bridge = USE_NEW_BRIDGE_FOR_JSI_SUPPORT ? WMDatabaseBridge : DatabaseBridge
  if (bridge.initializeJSI) {
    try {
      bridge.initializeJSI()
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
