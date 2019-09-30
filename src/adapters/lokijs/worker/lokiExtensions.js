// @flow

import Loki, { LokiMemoryAdapter, LokiPartitioningAdapter } from 'lokijs'
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'

export function newLoki(name: ?string, peristenceAdapter?: LokiMemoryAdapter): Loki {
  // const newAdapter =
  //   process.env.NODE_ENV === 'test' ? new LokiMemoryAdapter() : new LokiIndexedAdapter(name)
  const idbAdapter = new LokiIndexedAdapter(name)
  const newAdapter = new LokiPartitioningAdapter(idbAdapter)

  return new Loki(name, {
    adapter: peristenceAdapter || newAdapter,
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
