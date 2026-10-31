---
title: 'Setup'
hide_title: true
---

# Set up your app for WatermelonDB

Make sure you [installed Watermelon](./Installation.mdx) before proceeding.

Create `model/schema.js` in your project. You'll need it for [the next step](./Schema.md).

```js
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    // We'll add tableSchemas here later
  ]
})
```

Similarly, create `model/migrations.js`. ([More information about migrations](./Advanced/Migrations.md)):

```js
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    // We'll add migration definitions here later
  ],
})
```

Now, in your `index.native.js`:

```js
import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './model/schema'
import migrations from './model/migrations'
// import Post from './model/Post' // ⬅️ You'll import your Models here

// First, create the adapter to the underlying database:
const adapter = new SQLiteAdapter({
  schema,
  // (You might want to comment it out for development purposes -- see Migrations documentation)
  migrations,
  // (optional database name or file system path)
  // dbName: 'myapp',
  // (recommended option, should work flawlessly out of the box on iOS. On Android,
  // additional installation steps have to be taken - disable if you run into issues...)
  jsi: true, /* Platform.OS === 'ios' */
  // (optional, but you should implement this method)
  onSetUpError: error => {
    // Database failed to load -- offer the user to reload the app or log out
  }
})

// Then, make a Watermelon database from it!
const database = new Database({
  adapter,
  modelClasses: [
    // Post, // ⬅️ You'll add Models to Watermelon here
  ],
})
```

The above will work on React Native (iOS/Android) and NodeJS. For the web, instead of `SQLiteAdapter` use `LokiJSAdapter`:

```js
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({
  schema,
  // (You might want to comment out migrations for development purposes -- see Migrations documentation)
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  // dbName: 'myapp', // optional db name

  // --- Optional, but recommended event handlers:

  onQuotaExceededError: (error) => {
    // Browser ran out of disk space -- offer the user to reload the app or log out
  },
  onSetUpError: (error) => {
    // Database failed to load -- offer the user to reload the app or log out
  },
  onPersistenceError: (error) => {
    // Saving to IndexedDB failed (e.g. disk full, database deleted in another tab). Changes made
    // since the last successful save only exist in memory and will be lost if the page is closed.
    // Called once per failure, not on every autosave retry
  },
  // (true by default) Pass `false` to make setup fail (and call `onSetUpError`) instead of silently
  // falling back to an in-memory database when IndexedDB is unavailable (e.g. some private modes)
  allowInMemoryFallback: true,
  onInMemoryFallback: (reason) => {
    // IndexedDB is unavailable, so data will be lost when the page is closed -- warn the user
  },
  extraIncrementalIDBOptions: {
    onDidOverwrite: () => {
      // Called when this adapter is forced to overwrite contents of IndexedDB.
      // This happens if there's another open tab of the same app that's making changes.
      // Try to synchronize the app now, and if user is offline, alert them that if they close this
      // tab, some data may be lost
    },
    onversionchange: () => {
      // database was deleted in another browser tab (user logged out), so we must make sure we delete
      // it in this tab as well - usually best to just refresh the page
      // (from this point, this tab no longer saves to IndexedDB and rejects further changes)
      if (checkIfUserIsLoggedIn()) {
        window.location.reload()
      }
    },
  }
})

// The rest is the same!
```

:::note
On the web, `database.write()` resolves once changes are applied in memory. LokiJS saves them to IndexedDB shortly after (autosave), so a failure to save is only reported via `onPersistenceError`.

Multiple tabs of the same app share one IndexedDB database, but each tab keeps its own in-memory copy:

- When another tab deletes the database (e.g. on logout), this tab stops saving to IndexedDB, rejects further changes (including `unsafeExecute`), and calls `onPersistenceError` and `onversionchange`. Reload the page to continue.
- When two tabs make changes concurrently, the last tab to save overwrites changes saved by the other one (`onDidOverwrite` is called). WatermelonDB does not coordinate writers across tabs.
- `onPersistenceError`, `onInMemoryFallback`, `onQuotaExceededError` and `extraIncrementalIDBOptions` callbacks only work with `useWebWorker: false`.
:::

* * *

## Next steps

➡️ After Watermelon is installed, [**define your app's schema**](./Schema.md)
