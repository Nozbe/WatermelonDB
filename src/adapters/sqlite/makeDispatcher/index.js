// @flow
/* eslint-disable global-require */

import { fromPairs } from 'rambdax'

import DatabaseBridge from './node/DatabaseBridge'

import { logger } from '../../../utils/common'

import { fromPromise } from '../../../utils/fp/Result'

// Comment out type import instead of removing it completely
// import type { DispatcherType, SQLiteAdapterOptions, NativeDispatcher } from '../type'

import { syncReturnToResult } from '../common'

export { DatabaseBridge }

const dispatcherMethods = [
  'copyTables',
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
  'obliterateDatabase',
  'execSqlQuery',
  'enableNativeCDC',
]

export const makeDispatcher = (type, tag, _dbName) => {
  const methods = dispatcherMethods.map(methodName => {
    const name = type === 'synchronous' ? `${methodName}Synchronous` : methodName

    return [
      methodName,
      (...args) => {
        // $FlowFixMe
        const callback = args[args.length - 1]
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

export function getDispatcherType(options) {
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

export const EventType = {
  CDC: 'SQLITE_UPDATE_HOOK',
}

// Use require to avoid transpilation issues
const EventEmitter = require('events')

// Create the native event emitter class
class NativeEventEmitter extends EventEmitter {
  constructor() {
    super()
  }

  addListener(event, callback) {
    super.addListener(event, callback)
    this._event = event
    this.listener = callback
    return this
  }

  remove() {
    super.removeListener(this._event, this.listener)
  }
}

// Create and export the events instance - ensure it's initialized before export
const watermelonEvents = new NativeEventEmitter()
export const WatermelonDBEvents = watermelonEvents
