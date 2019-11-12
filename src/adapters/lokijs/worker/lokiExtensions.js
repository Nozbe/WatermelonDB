// @flow
/* eslint-disable no-undef */

import Loki, { LokiMemoryAdapter } from 'lokijs'

const isIDBAvailable = () => {
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
    checkRequest.onerror = () => {
      resolve(false)
    }
    checkRequest.onblocked = () => {
      // eslint-disable-next-line no-console
      console.error('WatermelonIDBChecker call is blocked')
    }
  })
}

async function getLokiAdapter(
  name: ?string,
  adapter: ?LokiMemoryAdapter,
  useIncrementalIDB: boolean,
  onIndexedDBVersionChange: ?() => void,
): mixed {
  if (adapter) {
    return adapter
  } else if (await isIDBAvailable()) {
    if (useIncrementalIDB) {
      const IncrementalIDBAdapter = require('lokijs/src/incremental-indexeddb-adapter')
      return new IncrementalIDBAdapter({
        onversionchange: onIndexedDBVersionChange,
      })
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(name)
  }

  // if IDB is unavailable (that happens in private mode), fall back to memory adapter
  // we could also fall back to localstorage adapter, but it will fail in all but the smallest dbs
  return new LokiMemoryAdapter()
}

export async function newLoki(
  name: ?string,
  adapter: ?LokiMemoryAdapter,
  useIncrementalIDB: boolean,
  onIndexedDBVersionChange: ?() => void,
): Loki {
  const loki = new Loki(name, {
    adapter: await getLokiAdapter(name, adapter, useIncrementalIDB, onIndexedDBVersionChange),
    autosave: true,
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
    loki.close()
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
}
