// @flow

import Loki, { LokiMemoryAdapter, LokiLocalStorageAdapter } from 'lokijs'

function getLokiAdapter(
  name: ?string,
  adapter: ?LokiMemoryAdapter,
  useIncrementalIDB: boolean,
): mixed {
  if (adapter) {
    return adapter
  } else if (process.env.NODE_ENV === 'test') {
    return new LokiMemoryAdapter()
  } else if (typeof window.indexedDB !== 'undefined') {
    if (useIncrementalIDB) {
      const IncrementalIDBAdapter = require('lokijs/src/incremental-indexeddb-adapter')
      return new IncrementalIDBAdapter()
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(name)
  } else if (typeof window.localStorage !== 'undefined') {
    // use local storage if IDB is unavailable
    return new LokiLocalStorageAdapter()
  }

  // if both IDB and LocalStorage are unavailable, use memory adapter (happens in private mode)
  return new LokiMemoryAdapter()
}

export function newLoki(
  name: ?string,
  adapter: ?LokiMemoryAdapter,
  useIncrementalIDB: boolean,
): Loki {
  return new Loki(name, {
    adapter: getLokiAdapter(name, adapter, useIncrementalIDB),
    autosave: true,
    autosaveInterval: 250,
    verbose: true,
  })
}

export async function loadDatabase(loki: Loki): Promise<void> {
  await new Promise((resolve, reject) => {
    loki.loadDatabase({}, error => {
      error ? reject(error) : resolve()
    })
  })
}

export async function deleteDatabase(loki: Loki): Promise<void> {
  await new Promise((resolve, reject) => {
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
