# Synchronization

WatermelonDB has been designed from scratch to be able to seamlessly synchronize with a remote database (and, therefore, keep multiple copies of data synced with each other).

Note that Watermelon is only a local database — you need to **bring your own backend**. What Watermelon provides are:

- **Synchronization primitives** — information about which records were created, updated, or deleted locally since the last sync — and which columns exactly were modified. You can build your own custom sync engine using those primitives
- **Built-in sync adapter** — You can use the sync engine Watermelon provides out of the box, and you only need to provide two API endpoints on your backend that conform to Watermelon sync protocol

## Using `synchronize()`

> ⚠️ The `synchronize()` function is not yet formally released (see changelog & pull requests for more details) and is currently experimental. There are extensive tests for this sync adapter, but it has not yet been battle tested. It's also not yet fully optimized, so you might experience less than ideal performance during sync.

Using Watermelon sync looks roughly like this:

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
  })
}

```

You need to pass two functions, `pullChanges` and `pushChanges` that can talk to your backend in a compatible way.

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

### `changes` objects

Changes (received from `pullChanges` and sent to `pushChanges`) are represented as an object with *raw records*. Those only use raw table and column names, and raw values (strings/numbers/booleans) — the same as in [Schema](../Schema.md).

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

### `pullChanges()`

Arguments: `{ lastPulledAt }`:
- `lastPulledAt` is a timestamp for the last time client pulled changes from server (or `null` if first sync)

This function should fetch from the server the list of ALL changes in all collections since `lastPulledAt`:
- records that were created on the server
- records that were updated on the server
- IDs of records that were deleted on the server

Return a Promise resolving to an object like this:

```
{
  changes: { ... },
  timestamp: 100000, // Return *server's* current time
}
```

Raw records passed must match your app [Schema](../Schema.md), and must not contain special `_status`, `_changed` fields.

The timestamp returned by the server must be a value that, if passed again to `pullChanges()` as `lastPulledAt`, will return all changes that happened since this moment.

### `pushChanges()`

This function will be called to push local (app) changes to the server

Arguments:

```
{
  changes: { ... },
  // the timestamp of the last successful pull (timestamp returned in pullChanges)
  lastSyncedAt: 10000,
}
```

**Note:** Records sent to pushChanges might contain special `_status`, `_changed` fields. You must ignore them. You must not mutate passed changes object.

`pushChanges` should call the server with the changes, and apply them remotely (create/update/delete on the server records that were created/updated/deleted locally).

If successful, `pushChanges` should resolve. If there's a problem, server should revert all changes, and `pushChanges` should reject.

If a record that's being pushed to the server has been changed on the server AFTER the time specified by `lastSyncedAt` (which means someone modified what we're pushing between pullChanges and pushChanges), we have a conflict, and push should be aborted. (`pushChanges` should reject). The local changes will sync during next sync.

### Implementation tips

Synchronization is serious business! It's very easy to make mistakes that will cause data loss. If you're not experienced at this, stick to these rules and suggestions:

- **Using `synchronize()`**
  - Ensure you never call `synchronize()` while synchronization is already in progress
  - We recommend wrapping `synchronize()` in a "retry once" block - if sync fails, try again once.
  - You can use `database.withChangesForTables` to detect when local changes occured to call sync
- **Implementing server-side changes tracking**
  - Add a `last_modified` field to all your server database tables, and bump it to `NOW()` every time you create or update a record.
  - This way, when you want to get all changes since `lastPulledAt`, you query records whose `last_modified > lastPulledAt`.
  - For extra safety, we recommend adding a MySQL/PostgreSQL procedure that will ensure `last_modified` uniqueness and monotonicity (will increment it by one if a record with this `last_modified` or greater already exists in the database).
    > This protects against weird edge cases related to server clock time changes (NTP time sync, leap seconds, etc.)
    > (Alternatively, instead of using timestamps, you could use auto-incrementing couters, but you'd have to ensure they are consistent across the whole database, not just one table)
  - You do need to implement a mechanism to track when records were deleted on the server, otherwise you wouldn't know to push them
  - To distinguish between `created` and `updated` records, you can also store server-side `server_created_at` timestamp (if it's greater than `last_pulled_at` supplied to sync, then record is to be `created` on client, if less than — client already has it and it is to be `updated` on client). Note that this timestamp must be consistent with last_modified — and you must not use client-created `created_at` field, since you can never trust local timestamps.
    - Alternatively, you can send all non-deleted records as all `updated` and Watermelon will do the right thing in 99% of cases (you will be slightly less protected against weird edge cases — treatment of locally deleted records is different). If you do this, pass `sendCreatedAsUpdated: true` to `synchronize()` to supress warnings about records to be updated not existing locally.
- **Implementing `GET changes` API endpoint**
  - Make sure you perform all queries (and checking for current timestamp) synchronously
    > This is to ensure that no changes are made to the database while you're fetching changes (otherwise you could never sync some records)
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
  > Note: That might conflict with "If client wants to update a record that doesn’t exist, create it"
4. The performance of `synchronize()` has not yet been optimized

### Contributing

1. If you implement Watermelon sync but found this guide confusing, please contribute improvements!
2. Please help out with solving the current limitations!
3. If you write server-side code made to be compatible with Watermelon, especially for popular platforms (Node, Ruby on Rails, Kinto, etc.) - please open source it and let us know! This would dramatically simplify implementing sync for people
4. If you find Watermelon sync bugs, please report the issue! And if possible, write regression tests to make sure it never happens again

## Sync primitives and implementing your own sync

For basic details about how changes tracking works, see: [📺 Digging deeper into WatermelonDB](https://www.youtube.com/watch?v=uFvHURTRLxQ)

Why you might want to implement a custom sync engine? If you have an existing remote server architecture that's difficult to adapt to Watermelon sync protocol, or you specifically want a different architecture (e.g. single HTTP request -- server resolves conflicts). Be warned, however, that implementing sync that works correctly is very hard.

For details about how Watermelon sync works, see design documentation in `sync/index.js`. You can use that as a blueprint for your own implementation.

If possible, please use sync implementation helpers from `sync/*.js` to keep your custom sync implementation have as much commonality as possible with the standard implementation. If the helpers are _almost_ what you need, but not quite, please send pull requests with improvements!
