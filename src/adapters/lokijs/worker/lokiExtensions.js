// @flow
/* eslint-disable no-undef */

import Loki, { LokiMemoryAdapter } from 'lokijs'
import { logger } from '../../../utils/common'
import type { LokiAdapterOptions } from '../index'

const isIDBAvailable = (onQuotaExceededError: ?(error: Error) => void) => {
  return new Promise(resolve => {
    // $FlowFixMe
    if (typeof indexedDB === 'undefined') {
      resolve(false)
    }

    // in Firefox private mode, IDB will be available, but will fail to open
    const checkRequest: IDBOpenDBRequest = indexedDB.open('WatermelonIDBChecker')
    checkRequest.onsuccess = e => {
      const db: IDBDatabase = e.target.result
      db.close()
      resolve(true)
    }
    checkRequest.onerror = event => {
      const error: ?Error = event?.target?.error
      // this is what Firefox in Private Mode returns:
      // DOMException: "A mutation operation was attempted on a database that did not allow mutations."
      // code: 11, name: InvalidStateError
      logger.error(
        '[WatermelonDB][Loki] IndexedDB checker failed to open. Most likely, user is in Private Mode. It could also be a quota exceeded error. Will fall back to in-memory database.',
        event,
        error,
      )
      if (error && error.name === 'QuotaExceededError') {
        logger.log('[WatermelonDB][Loki] Looks like disk quota was exceeded: ', error)
        onQuotaExceededError && onQuotaExceededError(error)
      }
      resolve(false)
    }
    checkRequest.onblocked = () => {
      logger.error('[WatermelonDB] IndexedDB checker call is blocked')
    }
  })
}

async function getLokiAdapter(options: LokiAdapterOptions): mixed {
  const {
    useIncrementalIndexedDB,
    _testLokiAdapter: adapter,
    onQuotaExceededError,
    onIndexedDBVersionChange,
    onIndexedDBFetchStart,
    dbName,
    indexedDBSerializer: serializer,
  } = options
  if (adapter) {
    return adapter
  } else if (await isIDBAvailable(onQuotaExceededError)) {
    if (useIncrementalIndexedDB) {
      const IncrementalIDBAdapter = require('lokijs/src/incremental-indexeddb-adapter')
      return new IncrementalIDBAdapter({
        onversionchange: onIndexedDBVersionChange,
        onFetchStart: onIndexedDBFetchStart,
        serializeChunk: serializer?.serializeChunk,
        deserializeChunk: serializer?.deserializeChunk,
      })
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(dbName)
  }

  // if IDB is unavailable (that happens in private mode), fall back to memory adapter
  // we could also fall back to localstorage adapter, but it will fail in all but the smallest dbs
  return new LokiMemoryAdapter()
}

export async function newLoki(options: LokiAdapterOptions): Loki {
  const { autosave = true } = options
  const loki = new Loki(options.dbName, {
    adapter: await getLokiAdapter(options),
    autosave,
    autosaveInterval: 250,
    verbose: true,
  })

  // force load database now
  await new Promise((resolve, reject) => {
    loki.loadDatabase({}, error => {
      error ? reject(error) : resolve()
    })
  })

  return loki
}

export async function deleteDatabase(loki: Loki): Promise<void> {
  await new Promise((resolve, reject) => {
    // Works around a race condition - Loki doesn't disable autosave or drain save queue before
    // deleting database, so it's possible to delete and then have the database be saved
    loki.close(() => {
      loki.deleteDatabase({}, response => {
        // LokiIndexedAdapter responds with `{ success: true }`, while
        // LokiMemory adapter just calls it with no params
        if ((response && response.success) || response === undefined) {
          resolve()
        } else {
          reject(response)
        }
      })
    })
  })
}
