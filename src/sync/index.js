// @flow

import { invariant } from '../utils/common'
import type { Database, RecordId, TableName, Model } from '..'
import { type DirtyRaw } from '../RawRecord'

import {
  applyRemoteChanges,
  fetchLocalChanges,
  markLocalChangesAsSynced,
  getLastPulledAt,
  setLastPulledAt,
  hasUnsyncedChanges as hasUnsyncedChangesImpl,
} from './impl'
import { ensureActionsEnabled, ensureSameDatabase } from './impl/helpers'

export type Timestamp = number

export type SyncTableChangeSet = $Exact<{
  created: DirtyRaw[],
  updated: DirtyRaw[],
  deleted: RecordId[],
}>
export type SyncDatabaseChangeSet = $Exact<{ [TableName<any>]: SyncTableChangeSet }>

export type SyncLocalChanges = $Exact<{ changes: SyncDatabaseChangeSet, affectedRecords: Model[] }>

export type SyncPullArgs = $Exact<{ lastPulledAt: ?Timestamp }>
export type SyncPullResult = $Exact<{ changes: SyncDatabaseChangeSet, timestamp: Timestamp }>

export type SyncPushArgs = $Exact<{ changes: SyncDatabaseChangeSet, lastPulledAt: Timestamp }>

export type SyncArgs = $Exact<{
  database: Database,
  pullChanges: SyncPullArgs => Promise<SyncPullResult>,
  pushChanges: SyncPushArgs => Promise<void>,
  sendCreatedAsUpdated?: boolean,
}>

// See Sync docs for usage details

export async function synchronize({
  database,
  pullChanges,
  pushChanges,
  sendCreatedAsUpdated,
}: SyncArgs): Promise<void> {
  ensureActionsEnabled(database)
  const resetCount = database._resetCount

  // pull phase
  const lastPulledAt = await getLastPulledAt(database)
  const { changes: remoteChanges, timestamp: newLastPulledAt } = await pullChanges({ lastPulledAt })
  await database.action(async action => {
    ensureSameDatabase(database, resetCount)
    invariant(
      lastPulledAt === (await getLastPulledAt(database)),
      '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
    )
    await action.subAction(() =>
      applyRemoteChanges(database, remoteChanges, !!sendCreatedAsUpdated),
    )
    await setLastPulledAt(database, newLastPulledAt)
  }, 'sync-synchronize-apply')

  // push phase
  const localChanges = await fetchLocalChanges(database)

  ensureSameDatabase(database, resetCount)
  await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })

  ensureSameDatabase(database, resetCount)
  await markLocalChangesAsSynced(database, localChanges)
}

export async function hasUnsyncedChanges({
  database,
}: $Exact<{ database: Database }>): Promise<boolean> {
  return hasUnsyncedChangesImpl(database)
}

/*

## Sync design and implementation

Read this if you want to contribute to Watermelon sync adapter or write your own custom one.

General design:
- two phase: first pull remote changes to local app, then push local changes to server
- client resolves conflicts
- content-based, not time-based conflict resolution
- conflicts are resolved using per-column client-wins strategy: in conflict, server version is taken
  except for any column that was changed locally since last sync.
- local app tracks its changes using a _status (synced/created/updated/deleted) field and _changes
  field (which specifies columns changed since last sync)
- server only tracks timestamps (or version numbers) of every record, not specific changes
- sync is performed for the entire database at once, not per-collection
- eventual consistency (client and server are consistent at the moment of successful pull if no
  local changes need to be pushed)
- non-blocking: local database writes (but not reads) are only momentarily locked when writing data
  but user can safely make new changes throughout the process

Procedure:
1. Pull phase
  - get `last pulled at` timestamp locally (null if first sync)
  - call push changes function, passing `lastPulledAt`
    - server responds with all changes (create/update/delete) that occured since `lastPulledAt`
    - server serves us with its current timestamp
  - IN ACTION (lock local writes):
    - ensure no concurrent syncs
    - apply remote changes locally
      - insert new records
        - if already exists (error), update
        - if locally marked as deleted (error), un-delete and update
      - update records
        - if synced, just replace contents with server version
        - if locally updated, we have a conflict!
          - take remote version, apply local fields that have been changed locally since last sync
            (per-column client wins strategy)
          - record stays marked as updated, because local changes still need to be pushed
        - if locally marked as deleted, ignore (deletion will be pushed later)
        - if doesn't exist locally (error), create
      - destroy records
        - if alredy deleted, ignore
        - if locally changed, destroy anyway
        - ignore children (server ought to schedule children to be destroyed)
    - if successful, save server's timestamp as new `lastPulledAt`
2. Push phase
  - Fetch local changes
    - Find all locally changed records (created/updated record + deleted IDs) for all collections
    - Strip _status, _changed
  - Call push changes function, passing local changes object, and the new `lastPulledAt` timestamp
    - Server applies local changes to database, and sends OK
    - If one of the pushed records has changed *on the server* since `lastPulledAt`, push is aborted,
      all changes reverted, and server responds with an error
  - IN ACTION (lock local writes):
    - markLocalChangesAsSynced:
      - take local changes fetched in previous step, and:
      - permanently destroy records marked as deleted
      - mark created/updated records as synced and reset their _changed field
      - note: *do not* mark record as synced if it changed locally since `fetch local changes` step
        (user could have made new changes that need syncing)

Notes:
- This procedure is designed such that if sync fails at any moment, and even leaves local app in inconsistent (not fully synced) state, we should still achieve consistency with the next sync:
  - applyRemoteChanges is designed such that if all changes are applied, but `lastPulledAt` doesn't get
    saved — so during next pull server will serve us the same changes, second applyRemoteChanges will
    arrive at the same result
  - local changes before "fetch local changes" step don't matter at all - user can do anything
  - local changes between "fetch local changes" and "mark local changes as synced" will be ignored
    (won't be marked as synced) - will be pushed during next sync
  - if changes don't get marked as synced, and are pushed again, server should apply them the same way
  - remote changes between pull and push phase will be locally ignored (will be pulled next sync)
    unless there's a per-record conflict (then push fails, but next sync resolves both pull and push)

This design has been informed by:
- 10 years of experience building synchronization at Nozbe
- Kinto & Kinto.js
  - https://github.com/Kinto/kinto.js/blob/master/src/collection.js
  - https://kintojs.readthedocs.io/en/latest/api/#fetching-and-publishing-changes
- Histo - https://github.com/mirkokiefer/syncing-thesis

*/
