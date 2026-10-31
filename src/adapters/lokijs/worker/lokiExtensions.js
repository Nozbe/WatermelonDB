// @flow
/* eslint-disable no-undef */

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'
import type { LokiAdapterOptions } from '../index'
import type { Loki } from '../type'

// App callbacks are called from Loki timers, IndexedDB event handlers and adapter setup, and must
// not change what happens next (or prevent other callbacks), so errors thrown by them are logged
function callSafely<T>(callback: ?(T) => void, arg: T): void {
  try {
    callback && callback(arg)
  } catch (error) {
    logger.error('[Loki] Error thrown by a LokiJSAdapter callback', error)
  }
}

// Resolves to `null` if IndexedDB can be used, or to an Error explaining why it can't
const checkIDB = (onQuotaExceededError: ?(error: Error) => void): Promise<?Error> => {
  return new Promise((resolve) => {
    let checkRequest: IDBOpenDBRequest
    try {
      // NOTE: Even accessing `indexedDB` can throw (e.g. in a sandboxed iframe)
      // $FlowFixMe
      if (typeof indexedDB === 'undefined') {
        resolve(new Error('IndexedDB is not available in this environment'))
        return
      }

      // in Firefox private mode, IDB will be available, but will fail to open
      // $FlowFixMe
      checkRequest = indexedDB.open('WatermelonIDBChecker')
    } catch (error) {
      // e.g. SecurityError when storage access is denied
      logger.error('[Loki] IndexedDB checker failed to open', error)
      resolve(error)
      return
    }
    checkRequest.onsuccess = (e) => {
      const db: IDBDatabase = e.target.result
      db.close()
      resolve(null)
    }
    checkRequest.onerror = (event) => {
      const error: ?Error = event?.target?.error
      // this is what Firefox in Private Mode returns:
      // DOMException: "A mutation operation was attempted on a database that did not allow mutations."
      // code: 11, name: InvalidStateError
      logger.error(
        '[Loki] IndexedDB checker failed to open. Most likely, user is in Private Mode. It could also be a quota exceeded error.',
        event,
        error,
      )
      if (error && error.name === 'QuotaExceededError') {
        logger.log('[Loki] Looks like disk quota was exceeded: ', error)
        callSafely(onQuotaExceededError, error)
      }
      resolve(error || new Error('IndexedDB failed to open'))
    }
    checkRequest.onblocked = () => {
      logger.error('IndexedDB checker call is blocked')
    }
  })
}

// Setting up an empty database opens it twice (see DatabaseDriver._migrateIfNeeded), so we keep
// track of what was reported, so that `onInMemoryFallback` is only called once per adapter
// (DatabaseDriver copies options, so each adapter has its own options object)
const reportedInMemoryFallbacks: WeakSet<LokiAdapterOptions> = new WeakSet()

async function getLokiAdapter(options: LokiAdapterOptions): mixed {
  const {
    useIncrementalIndexedDB,
    _testLokiAdapter: adapter,
    onQuotaExceededError,
    dbName,
    extraIncrementalIDBOptions = {},
    allowInMemoryFallback = true,
    onInMemoryFallback,
  } = options
  if (adapter) {
    return adapter
  }

  const idbError = await checkIDB(onQuotaExceededError)
  if (!idbError) {
    if (useIncrementalIndexedDB) {
      const IncrementalIDBAdapter = options._betaLoki
        ? require('lokijs/src/incremental-indexeddb-adapter')
        : require('lokijs/src/incremental-indexeddb-adapter')
      // NOTE: options are copied, because newLoki() installs its own `onversionchange` handler
      // $FlowFixMe
      return new IncrementalIDBAdapter({ ...extraIncrementalIDBOptions })
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(dbName)
  }

  // if IDB is unavailable (that happens in private mode), fall back to memory adapter
  // we could also fall back to localstorage adapter, but it will fail in all but the smallest dbs
  const reason = new Error(
    `[Loki] IndexedDB cannot be used (${idbError.name}: ${idbError.message}), so the database can only be kept in memory and will be lost when the page is closed`,
  )
  // $FlowFixMe
  reason.cause = idbError
  if (!allowInMemoryFallback) {
    logger.error(`${reason.message}. Refusing to set up, because allowInMemoryFallback is false`)
    throw reason
  }
  if (!reportedInMemoryFallbacks.has(options)) {
    reportedInMemoryFallbacks.add(options)
    logger.error(`${reason.message}. Falling back to in-memory database`)
    callSafely(onInMemoryFallback, reason)
  }

  const { LokiMemoryAdapter } = options._betaLoki ? require('lokijs') : require('lokijs')
  return new LokiMemoryAdapter()
}

// Loki reports save errors as whatever the persistence adapter passes: an Error, or, in case of
// IncrementalIndexedDBAdapter, sometimes the raw IndexedDB `error`/`abort` Event
function normalizePersistenceError(rawError: any): Error {
  if (rawError instanceof Error) {
    return rawError
  }
  const targetError = rawError && rawError.target && rawError.target.error
  if (targetError) {
    return targetError
  }
  if (rawError && rawError.type) {
    return new Error(`IndexedDB transaction failed (${rawError.type} event)`)
  }
  return new Error(`Unknown error while saving database: ${String(rawError)}`)
}

function createPersistenceErrorReporter(options: LokiAdapterOptions): {
  onSaveResult: (rawError: any) => void,
  reportFatal: (error: Error) => void,
} {
  const { onPersistenceError, onQuotaExceededError } = options
  // We only report the first failure until a save succeeds again, since autosave retries
  // a failing save every `autosaveInterval`
  let isFailing = false
  let isDead = false

  const report = (error: Error) => {
    if (error && error.name === 'QuotaExceededError') {
      callSafely(onQuotaExceededError, error)
    }
    callSafely(onPersistenceError, error)
  }

  return {
    onSaveResult: (rawError) => {
      if (isDead) {
        return
      }
      if (!rawError) {
        if (isFailing) {
          logger.log('[Loki] Database saved successfully after previous failures')
          isFailing = false
        }
        return
      }
      if (isFailing) {
        return
      }
      isFailing = true
      const error = normalizePersistenceError(rawError)
      logger.error(
        '[Loki] Failed to save database. Recent changes are only in memory and will be lost if the page is closed. Will keep retrying.',
        error,
      )
      report(error)
    },
    reportFatal: (error) => {
      if (isDead) {
        return
      }
      isDead = true
      isFailing = true
      logger.error(error.message)
      report(error)
    },
  }
}

// `onPersistenceLost` is called when the database can no longer be saved and the caller should
// stop accepting changes (currently: IndexedDB was deleted or upgraded by another connection)
export async function newLoki(
  options: LokiAdapterOptions,
  onPersistenceLost?: (error: Error) => void,
): Loki {
  const { extraLokiOptions = {} } = options
  const LokiDb = options._betaLoki ? require('lokijs') : require('lokijs')
  const reporter = createPersistenceErrorReporter(options)
  const adapter: any = await getLokiAdapter(options)

  let loki: ?Loki = null

  // When another connection deletes (or upgrades) the IndexedDB database - most likely, the user
  // logged out in another tab - IncrementalIDBAdapter closes its connection. If we kept going,
  // the next autosave would silently re-create the database from this tab's memory, bringing
  // the deleted data back. Instead, we stop saving and report it.
  if (adapter && adapter.mode === 'incremental' && adapter.options) {
    const userOnVersionChange = options.extraIncrementalIDBOptions?.onversionchange
    adapter.options.onversionchange = (event: any) => {
      const error = new Error(
        '[Loki] IndexedDB database was deleted or upgraded by another connection (most likely in another browser tab). To avoid re-creating it from memory, this database will not be saved anymore. App must be reloaded.',
      )
      error.name = 'VersionChangeError'
      // Stop saving and accepting changes before notifying app callbacks, so that they can't make
      // changes anymore, and so that a throwing callback can't prevent it
      loki && lokiFatalError(loki)
      callSafely(onPersistenceLost, error)
      reporter.reportFatal(error)
      // $FlowFixMe
      callSafely(userOnVersionChange, event)
    }
  }

  // $FlowFixMe
  loki = new LokiDb(options.dbName, {
    adapter,
    autosave: true,
    autosaveInterval: 500,
    autosaveCallback: reporter.onSaveResult,
    verbose: true,
    ...extraLokiOptions,
  })
  const _loki: Loki = loki

  // force load database now
  await new Promise((resolve, reject) => {
    _loki.loadDatabase({}, (error) => {
      error ? reject(error) : resolve()
    })
  })

  return _loki
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
