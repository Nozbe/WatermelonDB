// @flow

import type { Database } from '../..'
import { logError } from '../../utils/common'

import type { Timestamp } from '../index'

export { default as applyRemoteChanges } from './applyRemote'
export { default as fetchLocalChanges, hasUnsyncedChanges } from './fetchLocal'
export { default as markLocalChangesAsSynced } from './markAsSynced'

const lastSyncedAtKey = '__watermelon_last_pulled_at'

export async function getLastPulledAt(database: Database): Promise<?Timestamp> {
  return parseInt(await database.adapter.getLocal(lastSyncedAtKey), 10) || null
}

export async function setLastPulledAt(database: Database, timestamp: Timestamp): Promise<void> {
  const previousTimestamp = (await getLastPulledAt(database)) || 0
  if (timestamp < previousTimestamp) {
    logError(
      `[Sync] Pull has finished and received server time ${timestamp} — but previous pulled-at time was greater - ${previousTimestamp}. This is most likely server bug.`,
    )
  }

  await database.adapter.setLocal(lastSyncedAtKey, `${timestamp}`)
}
