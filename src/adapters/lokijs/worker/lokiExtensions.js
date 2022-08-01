// @flow
/* eslint-disable no-undef */

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'
import type { LokiAdapterOptions } from '../index'
import type { Loki } from '../type'

const isIDBAvailable = (onQuotaExceededError: ?(error: Error) => void) => {
  return new Promise((resolve) => {
    // $FlowFixMe
    if (typeof indexedDB === 'undefined') {
      resolve(false)
    }

    // in Firefox private mode, IDB will be available, but will fail to open
    const checkRequest: IDBOpenDBRequest = indexedDB.open('WatermelonIDBChecker')
    checkRequest.onsuccess = (e) => {
      const db: IDBDatabase = e.target.result
      db.close()
      resolve(true)
    }
    checkRequest.onerror = (event) => {
      const error: ?Error = event?.target?.error
      // this is what Firefox in Private Mode returns:
      // DOMException: "A mutation operation was attempted on a database that did not allow mutations."
      // code: 11, name: InvalidStateError
      logger.error(
        '[Loki] IndexedDB checker failed to open. Most likely, user is in Private Mode. It could also be a quota exceeded error. Will fall back to in-memory database.',
        event,
        error,
      )
      if (error && error.name === 'QuotaExceededError') {
        logger.log('[Loki] Looks like disk quota was exceeded: ', error)
        onQuotaExceededError && onQuotaExceededError(error)
      }
      resolve(false)
    }
    checkRequest.onblocked = () => {
      logger.error('IndexedDB checker call is blocked')
    }
  })
}

async function getLokiAdapter(options: LokiAdapterOptions): mixed {
  const {
    useIncrementalIndexedDB,
    _testLokiAdapter: adapter,
    onQuotaExceededError,
    dbName,
    extraIncrementalIDBOptions = {},
  } = options
  if (adapter) {
    return adapter
  } else if (await isIDBAvailable(onQuotaExceededError)) {
    if (useIncrementalIndexedDB) {
      const IncrementalIDBAdapter = options._betaLoki
        ? require('lokijs/src/incremental-indexeddb-adapter')
        : require('lokijs/src/incremental-indexeddb-adapter')
      // $FlowFixMe
      return new IncrementalIDBAdapter(extraIncrementalIDBOptions)
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(dbName)
  }

  // if IDB is unavailable (that happens in private mode), fall back to memory adapter
  // we could also fall back to localstorage adapter, but it will fail in all but the smallest dbs
  const { LokiMemoryAdapter } = options._betaLoki ? require('lokijs') : require('lokijs')
  return new LokiMemoryAdapter()
}

export async function newLoki(options: LokiAdapterOptions): Loki {
  const { extraLokiOptions = {} } = options
  const LokiDb = options._betaLoki ? require('lokijs') : require('lokijs')
  // $FlowFixMe
  const loki: Loki = new LokiDb(options.dbName, {
    adapter: await getLokiAdapter(options),
    autosave: true,
    autosaveInterval: 500,
    verbose: true,
    ...extraLokiOptions,
  })

  // force load database now
  await new Promise((resolve, reject) => {
    loki.loadDatabase({}, (error) => {
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
      loki.deleteDatabase({}, (response) => {
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

// In case of a fatal error, break Loki so that it cannot save its contents to disk anymore
// This might result in a loss of data in recent changes, but we assume that whatever caused the
// fatal error has corrupted the database, so we want to prevent it from being persisted
// There's no recovery from this, app must be restarted with a fresh LokiJSAdapter.
export function lokiFatalError(loki: Loki): void {
  try {
    // below is some very ugly defensive coding, but we're fatal and don't trust anyone anymore
    const fatalHandler = () => {
      throw new Error('Illegal attempt to save Loki database after a fatal error')
    }
    loki.save = fatalHandler
    loki.saveDatabase = fatalHandler
    loki.saveDatabaseInternal = fatalHandler
    // disable autosave
    loki.autosave = false
    loki.autosaveDisable()
    // close db
    loki.close()
  } catch (error) {
    logger.error('Failed to perform loki fatal error')
    logger.error(error)
  }
}
