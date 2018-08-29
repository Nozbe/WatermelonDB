// @flow

import Loki, { LokiMemoryAdapter } from 'lokijs'
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'

export function newLoki(name: string): Loki {
  const adapter =
    process.env.NODE_ENV === 'test' ? new LokiMemoryAdapter() : new LokiIndexedAdapter(name)

  return new Loki(name, {
    adapter,
    autosave: true,
    autosaveInterval: 250, // TODO: Remove this and force database save when we have transactions
    env: 'BROWSER', // TODO: ?
    verbose: true, // TODO: remove later
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
