---
title: Frontend
hide_title: true
---

## Implementing sync in frontend

## Using `synchronize()` in your app

To synchronize, you need to pass `pullChanges` and `pushChanges` _(optional)_ that talk to your backend and are compatible with Watermelon Sync Protocol. The frontend code will look something like this:

```js
import { synchronize } from '@nozbe/watermelondb/sync'

async function mySync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const urlParams = `last_pulled_at=${lastPulledAt}&schema_version=${schemaVersion}&migration=${encodeURIComponent(
        JSON.stringify(migration),
      )}`
      const response = await fetch(`https://my.backend/sync?${urlParams}`)
      if (!response.ok) {
        throw new Error(await response.text())
      }

      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`https://my.backend/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        body: JSON.stringify(changes),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
    },
    migrationsEnabledAtVersion: 1,
  })
}
```

#### Who calls `synchronize()`?

Upon looking at the example above, one question that may arise is who will call `synchronize()` -- or, in the example above `mySync()`. WatermelonDB does not manage the moment of invocation of the `synchronize()` function in any way. The database assumes every call of `pullChanges` will return _all_ the changes that haven't yet been replicated (up to `last_pulled_at`). The application code is responsible for calling `synchronize()` in the frequency it deems necessary.

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

## Checking unsynced changes

WatermelonDB has a built in function to check whether there are any unsynced changes. The frontend code will look something like this

```js
import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync'

async function checkUnsyncedChanges() {
  const database = useDatabase()
  await hasUnsyncedChanges({ database })
}
```

## General information and tips

1. You MUST NOT connect to backend endpoints you don't control using `synchronize()`. WatermelonDB assumes pullChanges/pushChanges are friendly and correct and does not guarantee secure behavior if data returned is malformed.
2. You SHOULD NOT call `synchronize()` while synchronization is already in progress (it will safely abort)
3. You MUST NOT reset local database while synchronization is in progress (push to server will be safely aborted, but consistency of the local database may be compromised)
4. You SHOULD wrap `synchronize()` in a "retry once" block - if sync fails, try again once. This will resolve push failures due to server-side conflicts by pulling once again before pushing.
5. You can use `database.withChangesForTables` to detect when local changes occured to call sync. If you do this, you should debounce (or throttle) this signal to avoid calling `synchronize()` too often.

## Adopting Migration Syncs

For Watermelon Sync to maintain consistency after [migrations](../Advanced/Migrations.md), you must support Migration Syncs (introduced in WatermelonDB v0.17). This allows Watermelon to request from backend the tables and columns it needs to have all the data.

1. For new apps, pass `{migrationsEnabledAtVersion: 1}` to `synchronize()` (or the first schema version that shipped / the oldest schema version from which it's possible to migrate to the current version)
2. To enable migration syncs, the database MUST be configured with [migrations spec](../Advanced/Migrations.md) (even if it's empty)
3. For existing apps, set `migrationsEnabledAtVersion` to the current schema version before making any schema changes. In other words, this version should be the last schema version BEFORE the first migration that should support migration syncs.
4. Note that for apps that shipped before WatermelonDB v0.17, it's not possible to determine what was the last schema version at which the sync happened. `migrationsEnabledAtVersion` is used as a placeholder in this case. It's not possible to guarantee that all necessary tables and columns will be requested. (If user logged in when schema version was lower than `migrationsEnabledAtVersion`, tables or columns were later added, and new records in those tables/changes in those columns occured on the server before user updated to an app version that has them, those records won't sync). To work around this, you may specify `migrationsEnabledAtVersion` to be the oldest schema version from which it's possible to migrate to the current version. However, this means that users, after updating to an app version that supports Migration Syncs, will request from the server all the records in new tables. This may be unacceptably inefficient.
5. WatermelonDB >=0.17 will note the schema version at which the user logged in, even if migrations are not enabled, so it's possible for app to request from backend changes from schema version lower than `migrationsEnabledAtVersion`
6. You MUST NOT delete old [migrations](../Advanced/Migrations.md), otherwise it's possible that the app is permanently unable to sync.

## (Advanced) Adopting Turbo Login

WatermelonDB v0.23 introduced an advanced optimization called "Turbo Login". Syncing using Turbo is up to 5.3x faster than the traditional method and uses a lot less memory, so it's suitable for even very large syncs. Keep in mind:

1. This can only be used for the initial (login) sync, not for incremental syncs. It is a serious programmer error to run sync in Turbo mode if the database is not empty.
2. Syncs with `deleted: []` fields not empty will fail.
3. Turbo only works with SQLiteAdapter with JSI enabled and running - it does not work on web, or if e.g. Chrome Remote Debugging is enabled
4. While Turbo Login is stable, it's marked as "unsafe", meaning that the exact API may change in a future version

Here's basic usage:

```js
const isFirstSync = ...
const useTurbo = isFirstSync
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    const response = await fetch(`https://my.backend/sync?${...}`)
    if (!response.ok) {
      throw new Error(await response.text())
    }

    if (useTurbo) {
      // NOTE: DO NOT parse JSON, we want raw text
      const json = await response.text()
      return { syncJson: json }
    } else {
      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    }
  },
  unsafeTurbo: useTurbo,
  // ...
})
```

Raw JSON text is required, so it is not expected that you need to do any processing in pullChanges() - doing that defeats much of the point of using Turbo Login!

If you're using pullChanges to send additional data to your app other than Watermelon Sync's `changes` and `timestamp`, you won't be able to process it in pullChanges. However, WatermelonDB can still pass extra keys in sync response back to the app - you can process them using `onDidPullChanges`. This works both with and without turbo mode:

```js
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // ...
  },
  unsafeTurbo: useTurbo,
  onDidPullChanges: async ({ messages }) => {
    if (messages) {
      messages.forEach((message) => {
        alert(message)
      })
    }
  },
  // ...
})
```

There's a way to make Turbo Login even more _turbo_! However, it requires native development skills. You need to develop your own native networking code, so that raw JSON can go straight from your native code to WatermelonDB's native code - skipping JavaScript processing altogether.

```js
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // NOTE: You need the standard JS code path for incremental syncs

    // Create a unique id for this sync request
    const syncId = Math.floor(Math.random() * 1000000000)

    await NativeModules.MyNetworkingPlugin.pullSyncChanges(
      // Pass the id
      syncId,
      // Pass whatever information your plugin needs to make the request
      lastPulledAt,
      schemaVersion,
      migration,
    )

    // If successful, return the sync id
    return { syncJsonId: syncId }
  },
  unsafeTurbo: true,
  // ...
})
```

In native code, perform network request and if successful, extract raw response body data - `NSData *` on iOS, `byte[]` on Android. Avoid extracting the response as a string or parsing the JSON. Then pass it to WatermelonDB's native code:

```java
// On Android (Java):
import com.nozbe.watermelondb.jsi.WatermelonJSI;

WatermelonJSI.provideSyncJson(/* id */ syncId, /* byte[] */ data);
```

```objc
// On iOS (Objective-C):
// (If using Swift, add the import to the bridging header)
#import <WatermelonDB/WatermelonDB.h>

watermelondbProvideSyncJson(syncId, data, &error)
```

## Adding logging to your sync

You can add basic sync logs to the sync process by passing an empty object to `synchronize()`. Sync will then mutate the object, populating it with diagnostic information (start/finish time, resolved conflicts, number of remote/local changes, any errors that occured, and more):

```js
// Using built-in SyncLogger
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger'
const logger = new SyncLogger(10 /* limit of sync logs to keep in memory */ )
await synchronize({ database, log: logger.newLog(), ... })

// this returns all logs (censored and safe to use in production code)
console.log(logger.logs)
// same, but pretty-formatted to a string (a user can easy copy this for diagnostic purposes)
console.log(logger.formattedLogs)


// You don't have to use SyncLogger, just pass a plain object to synchronize()
const log = {}
await synchronize({ database, log, ... })
console.log(log.startedAt)
console.log(log.finishedAt)
```

⚠️ Remember to act responsibly with logs, since they might contain your user's private information. Don't display, save, or send the log unless you censor the log.

## Debugging `changes`

If you want to conveniently see incoming and outgoing changes in sync in the console, add these lines to your pullChanges/pushChanges:

⚠️ Leaving such logging committed and running in production is a huge security vulnerability and a performance hog.

```js
// UNDER NO CIRCUMSTANCES SHOULD YOU COMMIT THESE LINES UNCOMMENTED!!!
require('@nozbe/watermelondb/sync/debugPrintChanges').default(changes, isPush)
```

Pass `true` for second parameter if you're checking outgoing changes (pushChanges), `false` otherwise. Make absolutely sure you don't commit this debug tool. For best experience, run this on web (Chrome) -- the React Native experience is not as good.

## (Advanced) Replacement Sync

Added in WatermelonDB 0.25, there is an alternative way to synchronize changes with the server called "Replacement Sync". You should only use this as last resort for cases difficult to deal with in an incremental fashion, due to performance implications.

Normally, `pullChanges` is expected to only return changes to data that had occured since `lastPulledAt`. During Replacement Sync, server sends the full dataset - _all_ records that user has access to, same as during initial (first/login) sync.

Instead of applying these changes normally, the app will replace its database with the data set received, except that local unpushed changes will be preserved. In other words:

- App will create records that are new locally, and update the rest to the server state as per usual
- Records that have unpushed changes locally will go through conflict resolution as per usual
- HOWEVER, instead of server passing a list of records to delete, app will delete local records not present in the dataset received
- Details on how unpushed changes are preserved:
    - Records marked as `created` are preserved so they have a chance to sync
    - Records marked as `updated` or `deleted` will be preserved if they're contained in dataset received. Otherwise, they're deleted (since they were remotely deleted/server no longer grants you accecss to them, these changes would be ignored anyway if pushed).

If there are no local (unpushed) changes before or during sync, replacement sync should yield the same state as clearing database and performing initial sync. In case replacement sync is performed with an empty dataset (and there are no local changes), the result should be equivalent to clearing database.

**When should you use Replacement Sync?**

- You can use it as a way to fix a bad sync state (mismatch between local and remote state)
- You can use it in case you have a very large state change and your server doesn't know how to correctly calculate incremental changes since last sync (e.g. accessible records changed in a very complex permissions system)

In such cases, you could alternatively relogin (clear the database, then perform initial sync again), however:

- Replacement Sync preserves local changes to records (and other state such as Local Storage), so there's minimal risk for data loss
- When clearing the database, you need to give up all references to Watermelon objects and stop all observation. Therefore, you need to unmount all UI that touches Watermelon, leading to poor UX. This is not required for Replacement Sync
- On the other hand, Replacement Sync is much, much slower than Turbo Login (it's not possible to combine the two techniques), so this technique might not scale to very large datasets

**Using Replacement Sync**

In `pullChanges`, return an object with an extra `strategy` field

    ```js
    {
      changes: { ... },
      timestamp: ...,
      experimentalStrategy: 'replacement',
    }
    ```

## Additional `synchronize()` flags

- `_unsafeBatchPerCollection: boolean` - if true, changes will be saved to the database in multiple batches. This is unsafe and breaks transactionality, however may be required for very large syncs due to memory issues
- `sendCreatedAsUpdated: boolean` - if your backend can't differentiate between created and updated records, set this to `true` to supress warnings. Sync will still work well, however error reporting, and some edge cases will not be handled as well.
- `conflictResolver: (TableName, local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw) => DirtyRaw` - can be passed to customize how records are updated when they change during sync. See `src/sync/index.js` for details.
- `onWillApplyRemoteChanges` - called after pullChanges is done, but before these changes are applied. Some stats about the pulled changes are passed as arguments. An advanced user can use this for example to show some UI to the user when processing a very large sync (could be useful for replacement syncs). Note that remote change count is NaN in turbo mode.


