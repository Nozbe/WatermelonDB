// @flow

import type { Database } from '../..'
import type { Timestamp } from '../index'

export { default as applyRemoteChanges } from './applyRemote'
export { default as fetchLocalChanges } from './fetchLocal'
export { default as markLocalChangesAsSynced } from './markAsSynced'

const lastSyncedAtKey = '__watermelon_last_pulled_at'

export async function getLastPulledAt(database: Database): Promise<?Timestamp> {
  return parseInt(await database.adapter.getLocal(lastSyncedAtKey), 10) || null
}

export async function setLastPulledAt(database: Database, timestamp: Timestamp): Promise<void> {
  await database.adapter.setLocal(lastSyncedAtKey, `${timestamp}`)
}
