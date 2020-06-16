# Synchronization

WatermelonDB has been designed from scratch to be able to seamlessly synchronize with a remote database (and, therefore, keep multiple copies of data synced with each other).

Note that Watermelon is only a local database — you need to **bring your own backend**. What Watermelon provides are:

- **Synchronization primitives** — information about which records were created, updated, or deleted locally since the last sync — and which columns exactly were modified. You can build your own custom sync engine using those primitives
- **Built-in sync adapter** — You can use the sync engine Watermelon provides out of the box, and you only need to provide two API endpoints on your backend that conform to Watermelon sync protocol

## Using `synchronize()` in your app

To synchronize, you need to pass two functions, `pullChanges` and `pushChanges` that talk to your backend and are compatible with Watermelon Sync Protocol. The frontend code will look something like this:

```js
import { synchronize } from '@nozbe/watermelondb/sync'

async function mySync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const response = await fetch(`https://my.backend/sync?last_pulled_at=${lastPulledAt}`)
      if (!response.ok) {
        throw new Error(await response.text())
      }

      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`https://my.backend/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        body: JSON.stringify(changes)
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
    },
    migrationsEnabledAtVersion: 1,
  })
}

```

### Troubleshooting

**⚠️ Note about a React Native / UglifyES bug**. When you import Watermelon Sync, your app might fail to compile in release mode. To fix this, configure Metro bundler to use Terser instead of UglifyES. Run:

```bash
yarn add metro-minify-terser
```

Then, update `metro.config.js`:

```js
module.exports = {
  // ...
  transformer: {
    // ...
    minifierPath: 'metro-minify-terser',
  },
}
```

You might also need to switch to Terser in Webpack if you use Watermelon for web.

### Implementing `pullChanges()`

Watermelon will call this function to ask for changes that happened on the server since the last pull.

Arguments:
- `lastPulledAt` is a timestamp for the last time client pulled changes from server (or `null` if first sync)
- `schemaVersion` is the current schema version of the local database
- `migration` is an object representing schema changes since last sync (or `null` if up to date or not supported)

This function should fetch from the server the list of ALL changes in all collections since `lastPulledAt`.

1. You MUST pass an async function or return a Promise that eventually resolves or rejects
2. You MUST pass `lastPulledAt`, `schemaVersion`, and `migration` to an endpoint that conforms to Watermelon Sync Protocol
3. You MUST return a promise resolving to an object of this shape (your backend SHOULD return this shape already):
    ```js
    {
      changes: { ... }, // valid changes object
      timestamp: 100000, // integer with *server's* current time
    }
    ```
4. You MUST NOT store the object returned in `pullChanges()`. If you need to do any processing on it, do it before returning the object. Watermelon treats this object as "consumable" and can mutate it (for performance reasons)

### Implementing `pushChanges()`

Watermelon will call this function with a list of changes that happened locally since the last push so you can post it to your backend.

Arguments passed:

```js
{
  changes: { ... }, // valid changes object
  lastPulledAt: 10000, // the timestamp of the last successful pull (timestamp returned in pullChanges)
}
```

1. You MUST pass `changes` and `lastPulledAt` to a push sync endpoint conforming to Watermelon Sync Protocol
2. You MUST pass an async function or return a Promise from `pushChanges()`
3. `pushChanges()` MUST resolve after and only after the backend confirms it successfully received local changes
4. `pushChanges()` MUST reject if backend failed to apply local changes
5. You MUST NOT resolve sync prematurely or in case of backend failure
6. You MUST NOT mutate or store arguments passed to `pushChanges()`. If you need to do any processing on it, do it before returning the object. Watermelon treats this object as "consumable" and can mutate it (for performance reasons)

### General information and tips

1. You MUST NOT connect to backend endpoints you don't control using `synchronize()`. WatermelonDB assumes pullChanges/pushChanges are friendly and correct and does not guarantee secure behavior if data returned is malformed.
2. You SHOULD NOT call `synchronize()` while synchronization is already in progress (it will safely abort)
3. You MUST NOT reset local database while synchronization is in progress (push to server will be safely aborted, but consistency of the local database may be compromised)
4. You SHOULD wrap `synchronize()` in a "retry once" block - if sync fails, try again once. This will resolve push failures due to server-side conflicts by pulling once again before pushing.
5. You can use `database.withChangesForTables` to detect when local changes occured to call sync. If you do this, you should debounce (or throttle) this signal to avoid calling `synchronize()` too often.

### Adopting Migration Syncs

For Watermelon Sync to maintain consistency after [migrations](./Migrations.md), you must support Migration Syncs (introduced in WatermelonDB v0.17). This allows Watermelon to request from backend the tables and columns it needs to have all the data.

1. For new apps, pass `{migrationsEnabledAtVersion: 1}` to `synchronize()` (or the first schema version that shipped / the oldest schema version from which it's possible to migrate to the current version)
2. To enable migration syncs, the database MUST be configured with [migrations spec](./Migrations.md) (even if it's empty)
3. For existing apps, set `migrationsEnabledAtVersion` to the current schema version before making any schema changes. In other words, this version should be the last schema version BEFORE the first migration that should support migration syncs.
4. Note that for apps that shipped before WatermelonDB v0.17, it's not possible to determine what was the last schema version at which the sync happened. `migrationsEnabledAtVersion` is used as a placeholder in this case. It's not possible to guarantee that all necessary tables and columns will be requested. (If user logged in when schema version was lower than `migrationsEnabledAtVersion`, tables or columns were later added, and new records in those tables/changes in those columns occured on the server before user updated to an app version that has them, those records won't sync). To work around this, you may specify `migrationsEnabledAtVersion` to be the oldest schema version from which it's possible to migrate to the current version. However, this means that users, after updating to an app version that supports Migration Syncs, will request from the server all the records in new tables. This may be unacceptably inefficient.
5. WatermelonDB >=0.17 will note the schema version at which the user logged in, even if migrations are not enabled, so it's possible for app to request from backend changes from schema version lower than `migrationsEnabledAtVersion`
6. You MUST NOT delete old [migrations](./Migrations.md), otherwise it's possible that the app is permanently unable to sync.

### Adding logging to your sync

You can add basic sync logs to the sync process by passing an empty object to `synchronize()`. Sync will then mutate the object, populating it with diagnostic information (start/finish time, resolved conflicts, and more):

```js
const log = {}
await synchronize({
database,
log,
...
})
console.log(log.startedAt)
console.log(log.finishedAt)
```

⚠️ Remember to act responsibly with logs, since they might contain your user's private information. Don't display, save, or send the log unless you censor the log. [Example logger and censor code you can use](https://gist.github.com/radex/a0a27761ac348f4a5552ecaf227d500c).

### Additional `synchronize()` flags

- `_unsafeBatchPerCollection: boolean` - if true, changes will be saved to the database in multiple batches. This is unsafe and breaks transactionality, however may be required for very large syncs due to memory issues
- `sendCreatedAsUpdated: boolean` - if your backend can't differentiate between created and updated records, set this to `true` to supress warnings. Sync will still work well, however error reporting, and some edge cases will not be handled as well.

## Implementing your Sync backend

### Understanding `changes` objects

Synchronized changes (received by the app in `pullChanges` and sent to the backend in `pushChanges`) are represented as an object with *raw records*. Those only use raw table and column names, and raw values (strings/numbers/booleans) — the same as in [Schema](../Schema.md).

Deleted objects are always only represented by their IDs.

Example:

```js
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

Valid changes objects MUST conform to this shape:

```js
Changes = {
  [table_name: string]: {
    created: RawRecord[],
    updated: RawRecord[],
    deleted: string[],
  }
}
```

### Implementing pull endpoint

Expected parameters:

```js
{
  lastPulledAt: Timestamp,
  schemaVersion: int,
  migration: null | { from: int, tables: string[], columns: { table: string, columns: string[] }[] }
}
```

Expected response:

```js
{ changes: Changes, timestamp: Timestamp }
```

1. The pull endpoint SHOULD take parameters and return a response matching the shape specified above.
    This shape MAY be different if negotiated with the frontend (however, frontend-side `pullChanges()` MUST conform to this)
2. The pull endpoint MUST return all record changes in all collections since `lastPulledAt`, specifically:
   - all records that were created on the server since `lastPulledAt`
   - all records that were updated on the server since `lastPulledAt`
   - IDs of all records that were deleted on the server since `lastPulledAt`
3. If `lastPulledAt` is null or 0, you MUST return all accessible records (first sync)
4. The timestamp returned by the server MUST be a value that, if passed again to `pullChanges()` as `lastPulledAt`, will return all changes that happened since this moment.
5. The pull endpoint MUST provide a consistent view of changes since `lastPulledAt`
   - You should perform all queries synchronously or in a write lock to ensure that returned changes are consistent
   - You should also mark the current server time synchronously with the queries
   - This is to ensure that no changes are made to the database while you're fetching changes (otherwise some records would never be returned in a pull query)
   - If it's absolutely not possible to do so, and you have to query each collection separately, be sure to return a `lastPulledAt` timestamp marked BEFORE querying starts. You still risk inconsistent responses (that may break app's consistency assumptions), but the next pull will fetch whatever changes occured during previous pull.
   - An alternative solution is to check for the newest change before and after all queries are made, and if there's been a change during the pull, return an error code, or retry.
6. If `migration` is not null, you MUST include records needed to get a consistent view after a local database migration
   - Specifically, you MUST include all records in tables that were added to the local database between the last user sync and `schemaVersion`
   - For all columns that were added to the local app database between the last sync and `schemaVersion`, you MUST include all records for which the added column has a value other than the default value (`0`, `''`, `false`, or `null` depending on column type and nullability)
   - You can determine what schema changes were made to the local app in two ways:
     - You can compare `migration.from` (local schema version at the time of the last sync) and `schemaVersion` (current local schema version). This requires you to negotiate with the frontend what schema changes are made at which schema versions, but gives you more control
     - Or you can ignore `migration.from` and only look at `migration.tables` (which indicates which tables were added to the local database since the last sync) and `migration.columns` (which indicates which columns were added to the local database to which tables since last sync).
     - If you use `migration.tables` and `migration.columns`, you MUST whitelist values a client can request. Take care not to leak any internal fields to the client.
7. Returned raw records MUST match your app's [Schema](../Schema.md)
8. Returned raw records MUST NOT not contain special `_status`, `_changed` fields.
9.  Returned raw records MAY contain fields (columns) that are not yet present in the local app (at `schemaVersion` -- but added in a later version). They will be safely ignored.
10. Returned raw records MUST NOT contain arbitrary column names, as they may be unsafe (e.g. `__proto__` or `constructor`). You should whitelist acceptable column names.
11. Returned record IDs MUST only contain safe characters
    - Default WatermelonDB IDs conform to `/^[a-zA-Z0-9]{16}$/`
    - `_-.` are also allowed if you override default ID generator, but `'"\/$` are unsafe
12. Changes SHOULD NOT contain collections that are not yet present in the local app (at `schemaVersion`). They will, however, be safely ignored.
    - NOTE: This is true for WatermelonDB v0.17 and above. If you support clients using earlier versions, you MUST NOT return collections not known by them.
13. Changes MUST NOT contain collections with arbitrary names, as they may be unsafe. You should whitelist acceptable collection names.

### Implementing push endpoint

1. The push endpoint MUST apply local changes (passed as a `changes` object) to the database. Specifically:
    - create new records as specified by the changes object
    - update existing records as specified by the changes object
    - delete records by the specified IDs
2. If the `changes` object contains a new record with an ID that already exists, you MUST update it, and MUST NOT return an error code.
    - (This happens if previous push succeeded on the backend, but not on frontend)
3. If the `changes` object contains an update to a record that does not exist, then:
    - If you can determine that this record no longer exists because it was deleted, you SHOULD return an error code (to force frontend to pull the information about this deleted ID)
    - Otherwise, you MUST create it, and MUST NOT return an error code. (This scenario should not happen, but in case of frontend or backend bugs, it would keep sync from ever succeeding.)
4. If the `changes` object contains a record to delete that doesn't exist, you MUST ignore it and MUST NOT return an error code
    - (This may happen if previous push succeeded on the backend, but not on frontend, or if another user deleted this record in between user's pull and push calls)
5. If the `changes` object contains a record that has been modified on the server after `lastPulledAt`, you MUST abort push and return an error code
    - This scenario means that there's a conflict, and record was updated remotely between user's pull and push calls. Returning an error forces frontend to call pull endpoint again to resolve the conflict
6. If application of all local changes succeeds, the endpoint MUST return a success status code.
7. The push endpoint MUST be fully transactional. If there is an error, all local changes MUST be reverted, and en error code MUST be returned.
8. You MUST ignore `_status` and `_changed` fields contained in records in `changes` object
9.  You SHOULD validate data passed to the endpoint. In particular, collection and column names ought to be whitelisted, as well as ID format — and of course any application-specific invariants, such as permissions to access and modify records
10. You SHOULD sanitize record fields passed to the endpoint. If there's something slightly wrong with the contents (but not shape) of the data (e.g. `user.role` should be `owner`, `admin`, or `member`, but user sent empty string or `abcdef`), you SHOULD NOT send an error code. Instead, prefer to "fix" errors (sanitize to correct format).
    - Rationale: Synchronization should be reliable, and should not fail other than transiently, or for serious programming errors. Otherwise, the user will have a permanently unsyncable app, and may have to log out/delete it and lose unsynced data. You don't want a bug 5 versions ago to create a persistently failing sync.
11. You SHOULD delete all descendants of deleted records
    - Frontend should ask the push endpoint to do so as well, but if it's buggy, you may end up with permanent orphans

### Tips on implementing server-side changes tracking

If you're wondering how to _actually_ implement consistent pulling of all changes since the last pull, or how to detect that a record being pushed by the user changed after `lastPulledAt`, here's what we recommend:

- Add a `last_modified` field to all your server database tables, and bump it to `NOW()` every time you create or update a record.
- This way, when you want to get all changes since `lastPulledAt`, you query records whose `last_modified > lastPulledAt`.
- The timestamp should be at least millisecond resolution, and you should add (for extra safety) a MySQL/PostgreSQL procedure that will ensure `last_modified` uniqueness and monotonicity
    - Specificaly, check that there is no record with a `last_modified` equal to or greater than `NOW()`, and if there is, increment the new timestamp by 1 (or however much you need to ensure it's the greatest number)
    - [An example of this for PostgreSQL can be found in Kinto](https://github.com/Kinto/kinto/blob/814c30c5dd745717b8ea50d708d9163a38d2a9ec/kinto/core/storage/postgresql/schema.sql#L64-L116)
    - This protects against weird edge cases - such as records being lost due to server clock time changes (NTP time sync, leap seconds, etc.)
- Of course, remember to ignore `last_modified` from the user if you do it this way.
- An alternative to using timestamps is to use an auto-incrementing counter sequence, but you must ensure that this sequence is consistent across all collections. You also leak to users the amount of traffic to your sync server (number of changes in the sequence)
- To distinguish between `created` and `updated` records, you can also store server-side `server_created_at` timestamp (if it's greater than `last_pulled_at` supplied to sync, then record is to be `created` on client, if less than — client already has it and it is to be `updated` on client). Note that this timestamp must be consistent with last_modified — and you must not use client-created `created_at` field, since you can never trust local timestamps.
  - Alternatively, you can send all non-deleted records as all `updated` and Watermelon will do the right thing in 99% of cases (you will be slightly less protected against weird edge cases — treatment of locally deleted records is different). If you do this, pass `sendCreatedAsUpdated: true` to `synchronize()` to supress warnings about records to be updated not existing locally.
- You do need to implement a mechanism to track when records were deleted on the server, otherwise you wouldn't know to push them
  - One possible implementation is to not fully delete records, but mark them as DELETED=true
  - Or, you can have a `deleted_xxx` table with just the record ID and timestamp (consistent with last_modified)
  - Or, you can treat it the same way as "revoked permissions"
- If you have a collaborative app with any sort of permissions, you also need to track granting and revoking of permissions the same way as changes to records
  - If permission to access records has been granted, the pull endpoint must add those records to `created`
  - If permission to access records has been revoked, the pull endpoint must add those records to `deleted`
  - Remember to also return all descendants of a record in those cases

## Local vs Remote IDs

WatermelonDB has been designed with the assumption that there is no difference between Local IDs (IDs of records and their relations in a WatermelonDB database) and Remote IDs (IDs on the backend server). So a local app can create new records, generating their IDs, and the backend server will use this ID as the true ID. This greatly simplifies synchronization, as you don't have to replace local with remote IDs on the record and all records that point to it.

We highly recommend that you adopt this practice.

Some people are skeptical about this approach due to conflicts, since backend can guarantee unique IDs, and the local app can't. However, in practice, a standard Watermelon ID has 8,000,000,000,000,000,000,000,000 possible combinations. That's enough entropy to make conflicts extremely unlikely. At [Nozbe](https://nozbe.com), we've done it this way at scale for more than a decade, and not once did we encounter a genuine ID conflict or had other issues due to this approach.

> Using the birthday problem, we can calculate that for 36^16 possible IDs, if your system grows to a billion records, the probability of a single conflict is 6e-8. At 100B records, the probability grows to 0.06%. But if you grow to that many records, you're probably a very rich company and can start worrying about things like this _then_.

If you absolutely can't adopt this practice, there's a number of production apps using WatermelonDB that keep local and remote IDs separate — however, more work is required this way. Search Issues to find discussions about this topic — and consider contributing to WatermelonDB to make managing separate local IDs easier for everyone!

## Existing backend implementations for WatermelonDB

Note that those are not maintained by WatermelonDB, and we make no endorsements about quality of these projects:

- [How to Build WatermelonDB Sync Backend in Elixir](https://fahri.id/posts/how-to-build-watermelondb-sync-backend-in-elixir/)
- [Firemelon](https://github.com/AliAllaf/firemelon)
- Did you make one? Please contribute a link!

## Current Sync limitations

1. If a record being pushed changes between pull and push, push will just fail. It would be better if it failed with a list of conflicts, so that `synchronize()` can automatically respond. Alternatively, sync could only send changed fields and server could automatically always just apply those changed fields to the server version (since that's what per-column client-wins resolver will do anyway)
2. During next sync pull, changes we've just pushed will be pulled again, which is unnecessary. It would be better if server, during push, also pulled local changes since `lastPulledAt` and responded with NEW timestamp to be treated as `lastPulledAt`.
3. It shouldn't be necessary to push the whole updated record — just changed fields + ID should be enough
  > Note: That might conflict with "If client wants to update a record that doesn’t exist, create it"

You don't like these limitations? Good, neither do we! Please contribute - we'll give you guidance.

## Contributing

1. If you implement Watermelon sync but found this guide confusing, please contribute improvements!
2. Please help out with solving the current limitations!
3. If you write server-side code made to be compatible with Watermelon, especially for popular platforms (Node, Ruby on Rails, Kinto, etc.) - please open source it and let us know! This would dramatically simplify implementing sync for people
4. If you find Watermelon sync bugs, please report the issue! And if possible, write regression tests to make sure it never happens again

## Sync primitives and implementing your own sync entirely from scratch

See: [Sync implementation details](../Implementation/SyncImpl.md)
