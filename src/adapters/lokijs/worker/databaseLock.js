// @flow
/* eslint-disable no-undef */

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'
import type { LokiAdapterOptions } from '../index'

import { callSafely } from './lokiExtensions'

// Never settles - the lock is held until the page (or worker) is closed
const holdForever = (): Promise<void> => new Promise(() => {})

// Acquires an exclusive Web Lock for this database, so that only one browser tab at a time has it
// open (see `exclusiveLock` option). Resolves once the lock is held. If another tab holds it,
// `onDatabaseLockedElsewhere` is called, and this waits until that tab is closed.
// `onLockLost` is called if the lock is taken away later (e.g. stolen using DevTools).
// If the Web Locks API is unavailable, the database is opened without a lock.
export async function acquireDatabaseLock(
  options: LokiAdapterOptions,
  onLockLost: (error: Error) => void,
): Promise<void> {
  // $FlowFixMe
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks || typeof locks.request !== 'function') {
    logger.warn(
      '[Loki] exclusiveLock is enabled, but the Web Locks API (navigator.locks) is not available (e.g. old browser or insecure context). Opening the database without a lock, so changes made in multiple tabs can overwrite each other',
    )
    return
  }

  // NOTE: `loki.db` is Loki's default database name (used if dbName is not passed)
  const name = `WatermelonDB:${options.dbName || 'loki.db'}`

  // NOTE: `request()` resolves (or rejects) when the lock is released, and rejects with AbortError
  // if it is stolen. Rejections before the lock is granted are passed to the caller.
  const request = (lockOptions: Object): Promise<boolean> =>
    new Promise((resolve, reject) => {
      let isGranted = false
      locks
        .request(name, lockOptions, (lock) => {
          if (!lock) {
            // not available (ifAvailable: true)
            resolve(false)
            return undefined
          }
          isGranted = true
          resolve(true)
          return holdForever()
        })
        .then(
          () => {},
          (error) => {
            if (isGranted) {
              logger.error('[Loki] Database lock was lost', error)
              const lostError = new Error(
                `[Loki] Exclusive database lock was lost (${error?.name}: ${error?.message}). To avoid overwriting changes made in another tab, this database will not be saved anymore. App must be reloaded.`,
              )
              lostError.name = 'DatabaseLockLostError'
              callSafely(onLockLost, lostError)
            } else {
              reject(error)
            }
          },
        )
    })

  if (await request({ mode: 'exclusive', ifAvailable: true })) {
    return
  }

  logger.warn(`[Loki] Database is open in another tab. Waiting until it's closed...`)
  callSafely(options.onDatabaseLockedElsewhere, undefined)
  await request({ mode: 'exclusive' })
  logger.log('[Loki] Database lock acquired')
}
