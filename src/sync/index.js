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
  ensureActionsEnabled,
} from './impl'

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
}>

/*

# Watermelon synchronization protocol

To synchronize, you need to pass two functions, `pullChanges` and `pushChanges` that can talk to your
backend.

Changes are represented as an object with *raw records*. Those only use raw table and column names,
and raw values (strings/numbers/booleans) — the same as in Schema. Deleted objects are always only
represented by their IDs.

Example:

```
{
  projects: {
    created: [
      { id: 'aaaa', name: 'Foo', is_favorite: true },
      { id: 'bbbb', name: 'Bar', is_favorite: false },
    ],
    updated: [
      { id: 'ccc', name: 'Baz', is_favorite: true },
    ],
    deleted: ['ddd'],
  },
  tasks: {
    created: [],
    updated: [
      { id: 'tttt', name: 'Buy eggs' },
    ],
    deleted: [],
  },
  ...
}
```

### pullChanges

Arguments: `{ lastPulledAt }`:
- `lastPulledAt` is a timestamp for the last time client pulled changes from server (or `null` if first sync)

This function should fetch from the server the list of ALL changes in all collections since `lastPulledAt`:
- records that were created on the server
- records that were updated on the server
- IDs of records that were deleted on the server

Expected return value (in a Promise):

```
{
  changes: {
    collection1: { created: [], updated: [], deleted: [] },
    // ... (same as explained before)
  },
  timestamp: 100000, // Return *server's* current time
}
```

Raw records passed must match Schema, and must not contain special `_status`, `_changed` fields.

The timestamp returned by the server must be a value that, if passed again to `pullChanges()` as `lastPulledAt`, will return all changes that happened since this moment.

### pushChanges

This function will be called to push local (app) changes to the server

Arguments:

```
{
  changes: {
    collection1: { created: [{ id: ... }, ...], updated: [], deleted: [] },
    ... (same as explained before)
  },
  lastSyncedAt: 10000, // the timestamp of the last successful pull (timestamp returned in pullChanges)
}
```

Note: Records sent to pushChanges might contain special `_status`, `_changed` fields. You must ignore them. You must not mutate passed changes object.

`pushChanges` should call the server with the changes, and apply them remotely (create/update/delete on the server records that were created/updated/deleted locally).

If successful, `pushChanges` should resolve. If there's a problem, server should revert all changes, and `pushChanges` should reject.

If a record that's being pushed to the server has been changed on the server AFTER the time specified by `lastSyncedAt` (which means someone modified what we're pushing between pullChanges and pushChanges), we have a conflict, and push should be aborted. (`pushChanges` should reject). The local changes will sync during next sync.

### Implementation tips

Synchronization is serious business! It's very easy to make mistakes that will cause data loss. If you're
not experienced at this, stick to these rules and suggestions:

- **Using `synchronize()`**
  - Ensure you never call `synchronize()` while synchronization is already in progress
  - We recommend wrapping `synchronize()` in a "retry once" block - if sync fails, try again once.
- **Implementing server-side changes tracking**
  - Add a `last_modified` field to all your server database tables, and bump it to `NOW()` every time you create or update a record.
  - This way, when you want to get all changes since `lastPulledAt`, you query records whose `last_modified > lastPulledAt`.
  - For extra safety, we recommend adding a MySQL/PostgreSQL procedure that will ensure `last_modified` uniqueness and monotonicity (will increment it by one if a record with this `last_modified` or greater already exists in the database).
    > This protects against weird edge cases related to server clock time changes (NTP time sync, leap seconds, etc.)
    > (Alternatively, instead of using timestamps, you could use auto-incrementing couters, but you'd have to ensure they are consistent across the whole database, not just one table)
  - You do need to implement a mechanism to track when records were deleted on the server, otherwise you wouldn't know to push them
- **Implementing `GET changes` API endpoint**
  - Make sure you perform all queries (and checking for current timestamp) synchronously
    > this is to ensure that no changes are made to the database while you're fetching changes (otherwise you could never sync some records)
    - if it's not possible to do so (you have to query each collection separately), be sure to mark `NOW()` to respond with at the *beginning* of the process. You still risk inconsistent responses, but the next pull will fetch whatever changes occured during previous pull.
- **Implementing `POST changes` API endpoint**
  - Make sure you perform all changes on all tables in a transaction! If push fails, you don't want partially applied changes.
  - Compare db record's `last_modified` time with `lastPulledAt`. If it's greater, we have a conflict, and you must abort transaction and return error status.
  - If client wants to:
    - … delete a record that don't exist — just ignore it
    - … update a record that doesn't exist, create it
    - … create a record that does exist, update it
  - If there's something wrong with the data format, prefer to "fix" the data if possible instead of failing sync. You don't want the user to have an unsyncable app because of a mistake caused by a bug 5 versions ago.
  - As with any API, remember to check permissions to create/modify records, make sure you version your API together with local Schema versioning, and all other standard stuff!

### Current limitations

1. If a record being pushed changes between pull and push, push will just fail. It would be better if it failed with a list of conflicts, so that `synchronize()` can automatically respond. Alternatively, sync could only send changed fields and server could automatically always just apply those changed fields to the server version (since that's what per-column client-wins resolver will do anyway)
2. During next sync pull, changes we've just pushed will be pulled again, which is unnecessary. It would be better if server, during push, also pulled local changes since `lastPulledAt` and responded with NEW timestamp to be treated as `lastPulledAt`.
3. It shouldn't be necessary to push the whole updated record — just changed fields + ID should be enough

### Contributing

1. If you implement Watermelon sync but found this guide confusing, please contribute improvements!
2. Please help out with solving the current limitations!
3. If you write server-side code made to be compatible with Watermelon, especially for popular platforms (Node, Ruby on Rails, Kinto, etc.) - please open source it and let us know! This would dramatically simplify implementing sync for people
4. If you find Watermelon sync bugs, please report the issue! And if possible, write regression tests to make sure it never happens again
5. If you want to implement a different synchronization scheme (e.g. single push / server resolves conflict), check out synchronization implementation details, use Watermelon sync helpers if possible, and contribute the result back if possible!

*/

export async function synchronize({ database, pullChanges, pushChanges }: SyncArgs): Promise<void> {
  ensureActionsEnabled(database)

  // pull phase
  const lastPulledAt = await getLastPulledAt(database)
  const { changes: remoteChanges, timestamp: newLastPulledAt } = await pullChanges({ lastPulledAt })
  await database.action(async action => {
    invariant(
      lastPulledAt === (await getLastPulledAt(database)),
      '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
    )
    await action.subAction(() => applyRemoteChanges(database, remoteChanges))
    await setLastPulledAt(database, newLastPulledAt)
  }, 'sync-synchronize-apply')

  // push phase
  const localChanges = await fetchLocalChanges(database)
  await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })
  await markLocalChangesAsSynced(database, localChanges)
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
