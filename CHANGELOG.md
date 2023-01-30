# Changelog

All notable changes to this project will be documented in this file.

Contributors: Please add your changes to CHANGELOG-Unreleased.md

## 0.25.3 - 2023-01-31

- Fixed TypeError regression

## 0.25.2 - 2023-01-30

### Fixes

- Fix TypeScript issues (@paulrostorp feat. @enahum)
- Fix compilation on Kotlin 1.7
- Fix regression in Sync that could cause `Record ID xxx#yyy was sent over the bridge, but it's not cached` error

### Internal

- Update internal dependencies
- Fix Android CI
- Improve TypeScript CI

## 0.25.1 - 2023-01-23

- Fix React Native 0.71+ Android broken build

## 0.25 - 2023-01-20

### Highlights

- Fix broken build on React Native 0.71+
- [Expo] Fixes Expo SDK 44+ build errors (@Kudo)
- [JSI] Fix an issue that sometimes led to crashing app upon database close

### BREAKING CHANGES

- [Query] `Q.where(xxx, undefined)` will now throw an error. This is a bug fix, since comparing to
  undefined was never allowed and would either error out or produce a wrong result in some cases.
  However, it could technically break an app that relied on existing buggy behavior
- [JSI+Swift] If you use `watermelondbProvideSyncJson()` native iOS API, you might need to add `import WatermelonDB`

### New features

- [adapters] Adapter objects can now be distinguished by checking their `static adapterType`
- [Query] New `Q.includes('foo')` query for case-sensitive exact string includes comparison
- [adapters] Adapter objects now returns `dbName`
- [Sync] Replacement Sync - a new advanced sync feature. Server can now send a full dataset (same as
  during initial sync) and indicate with `{ experimentalStrategy: 'replacement' }` that instead of applying a diff,
  local database should be replaced with the dataset sent. Local records not present in the changeset
  will be deleted. However, unlike clearing database and logging in again, unpushed local changes
  (to records that are kept after replacement) are preserved. This is useful for recovering from a
  corrupted local database, or as a hack to deal with very large state changes such that server doesn't
  know how to efficiently send incremental changes and wants to send a full dataset instead. See docs
  for more details.
- [Sync] Added `onWillApplyRemoteChanges` callback

### Performance

- [LokiJS] Updated Loki with some performance improvements
- [iOS] JSLockPerfHack now works on iOS 15
- [Sync] Improved performance of processing large pulls
- Improved `@json` decorator, now with optional `{ memo: true }` parameter

### Changes

- [Docs] Added additional Android JSI installation step

### Fixes

- [TypeScript] Improve typings: add unsafeExecute method, localStorage property to Database
- [android] Fixed compilation on some setups due to a missing <cassert> import
- [sync] Fixed marking changes as synced for users that don't keep globally unique (only per-table unique) IDs
- Fix `Model.experimentalMarkAsDeleted/experimentalDestroyPermanently()` throwing an error in some cases
- Fixes included in updated `withObservables`

## 0.24 - 2021-10-28

### BREAKING CHANGES

- `Q.experimentalSortBy`, `Q.experimentalSkip`, `Q.experimentalTake` have been renamed to `Q.sortBy`, `Q.skip`, `Q.take` respectively
- **RxJS has been updated to 7.3.0**. If you're not importing from `rxjs` in your app, this doesn't apply to you. If you are, read RxJS 7 breaking changes: https://rxjs.dev/deprecations/breaking-changes

### New features

- **LocalStorage**. `database.localStorage` is now available
- **sortBy, skip, take** are now available in LokiJSAdapter as well
- **Disposable records**. Read-only records that cannot be saved in the database, updated, or deleted and only exist for as long as you keep a reference to them in memory can now be created using `collection.disposableFromDirtyRaw()`. This is useful when you're adding online-only features to an otherwise offline-first app.
- [Sync] `experimentalRejectedIds` parameter now available in push response to allow partial rejection of an otherwise successful sync

### Fixes

- Fixes an issue when using Headless JS on Android with JSI mode enabled - pass `usesExclusiveLocking: true` to SQLiteAdapter to enable
- Fixes Typescript annotations for Collection and adapters/sqlite

## 0.23 - 2021-07-22

This is a big release to WatermelonDB with new advanced features, great performance improvements, and important fixes to JSI on Android.

Please don't get scared off the long list of breaking changes - they are all either simple Find&Replace renames or changes to internals you probably don't use. It shouldn't take you more than 15 minutes to upgrade to 0.23.

### BREAKING CHANGES

- **iOS Installation change**. You need to add this line to your Podfile: `pod 'simdjson', path: '../node_modules/@nozbe/simdjson'`
- Deprecated `new Database({ actionsEnabled: false })` options is now removed. Actions are always enabled.
- Deprecated `new SQLiteAdapter({ synchronous: true })` option is now removed. Use `{ jsi: true }` instead.
- Deprecated `Q.unsafeLokiFilter` is now removed. Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.
- Deprecated `Query.hasJoins` is now removed
- Changes to `LokiJSAdapter` constructor options:
  - `indexedDBSerializer` -> `extraIncrementalIDBOptions: { serializeChunk, deserializeChunk }`
  - `onIndexedDBFetchStart` -> `extraIncrementalIDBOptions: { onFetchStart }`
  - `onIndexedDBVersionChange` -> `extraIncrementalIDBOptions: { onversionchange }`
  - `autosave: false` -> `extraLokiOptions: { autosave: false }`
- Changes to Internal APIs. These were never meant to be public, and so are unlikely to affect you:
  - `Model._isCommited`, `._hasPendingUpdate`, `._hasPendingDelete` have been removed and changed to `Model._pendingState`
  - `Collection.unsafeClearCache()` is no longer exposed
- Values passed to `adapter.setLocal()` are now validated to be strings. This is technically a bug fix, since local storage was always documented to only accept strings, however applications may have relied on this lack of validation. Adding this validation was necessary to achieve consistent behavior between SQLiteAdapter and LokiJSAdapter
- `unsafeSql` passed to `appSchema` will now also be called when dropping and later recreating all database indices on large batches. A second argument was added so you can distinguish between these cases. See Schema docs for more details.
- **Changes to sync change tracking**. The behavior of `record._raw._changed` and `record._raw._status` (a.k.a. `record.syncStatus`) has changed. This is unlikely to be a breaking change to you, unless you're writing your own sync engine or rely on these low-level details.
  - Previously, _changed was always empty when _status=created. Now, _changed is not populated during initial creation of a record, but a later update will add changed fields to _changed. This change was necessary to fix a long-standing Sync bug.

### Deprecations

- `database.action(() => {})` is now deprecated. Use `db.write(() => {})` instead (or `db.read(() => {})` if you only need consistency but are not writing any changes to DB)
- `@action` is now deprecated. Use `@writer` or `@reader` instead
- `.subAction()` is now deprecated. Use `.callReader()` or `.callWriter()` instead
- `Collection.unsafeFetchRecordsWithSQL()` is now deprecated. Use `collection.query(Q.unsafeSqlQuery("select * from...")).fetch()` instead.

### New features

- `db.write(writer => { ... writer.batch() })` - you can now call batch on the interface passed to a writer block
- **Fetching record IDs and unsafe raws.** You can now optimize fetching of queries that only require IDs, not full cached records:
  - `await query.fetchIds()` will return an array of record ids
  - `await query.unsafeFetchRaw()` will return an array of unsanitized, unsafe raw objects (use alongside `Q.unsafeSqlQuery` to exclude unnecessary or include extra columns)
  - advanced `adapter.queryIds()`, `adapter.unsafeQueryRaw` are also available
- **Raw SQL queries**. New syntax for running unsafe raw SQL queries:
  - `collection.query(Q.unsafeSqlQuery("select * from tasks where foo = ?", ['bar'])).fetch()`
  - You can now also run `.fetchCount()`, `.fetchIds()` on SQL queries
  - You can now safely pass values for SQL placeholders by passing an array
  - You can also observe an unsafe raw SQL query -- with some caveats! refer to documentation for more details
- **Unsafe raw execute**. You can now execute arbitrary SQL queries (SQLiteAdapter) or access Loki object directly (LokiJSAdapter) using `adapter.unsafeExecute` -- see docs for more details
- **Turbo Login**. You can now speed up the initial (login) sync by up to 5.3x with Turbo Login. See Sync docs for more details.
- New diagnostic tool - **debugPrintChanges**. See Sync documentation for more details

### Performance

- The order of Q. clauses in a query is now preserved - previously, the clauses could get rearranged and produce a suboptimal query
- [SQLite] `adapter.batch()` with large numbers of created/updated/deleted records is now between 16-48% faster
- [LokiJS] Querying and finding is now faster - unnecessary data copy is skipped
- [jsi] 15-30% faster querying on JSC (iOS) when the number of returned records is large
- [jsi] up to 52% faster batch creation (yes, that's on top of the improvement listed above!)
- Fixed a performance bug that caused observed items on a list observer with `.observeWithColumns()` to be unnecessarily re-rendered just before they were removed from the list

### Changes

- All Watermelon console logs are prepended with a 🍉 tag
- Extra protections against improper use of writers/readers (formerly actions) have been added
- Queries with multiple top-level `Q.on('table', ...)` now produce a warning. Use `Q.on('table', [condition1, condition2, ...])` syntax instead.
- [jsi] WAL mode is now used

### Fixes

- [jsi] Fix a race condition where commands sent to the database right after instantiating SQLiteAdapter would fail
- [jsi] Fix incorrect error reporting on some sqlite errors
- [jsi] Fix issue where app would crash on Android/Hermes on reload
- [jsi] Fix IO errors on Android
- [sync] Fixed a long-standing bug that would cause records that are created before a sync and updated during sync's push to lose their most recent changes on a subsequent sync

### Internal

- Internal changes to SQLiteAdapter:
  - .batch is no longer available on iOS implementation
  - .batch/.batchJSON internal format has changed
  - .getDeletedRecords, destroyDeletedRecords, setLocal, removeLocal is no longer available
- encoded SQLiteAdapter schema has changed
- LokiJSAdapter has had many internal changes

## 0.22 - 2021-05-07

### BREAKING CHANGES

- [SQLite] `experimentalUseJSI: true` option has been renamed to `jsi: true`

### Deprecations

- [LokiJS] `Q.unsafeLokiFilter` is now deprecated and will be removed in a future version.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.

### New features

- [SQLite] [JSI] `jsi: true` now works on Android - see docs for installation info

### Performance

- Removed dependency on rambdax and made the util library smaller
- Faster withObservables

### Changes

- Synchronization: `pushChanges` is optional, will not calculate local changes if not specified.
- withObservables is now a dependency of WatermelonDB for simpler installation and consistent updates. You can (and generally should) delete `@nozbe/with-observables` from your app's package.json
- [Docs] Add advanced tutorial to share database across iOS targets - @thiagobrez
- [SQLite] Allowed callbacks (within the migrationEvents object) to be passed so as to track the migration events status ( onStart, onSuccess, onError ) - @avinashlng1080
- [SQLite] Added a dev-only `Query._sql()` method for quickly extracting SQL from Queries for debugging purposes

### Fixes

- Non-react statics hoisting in `withDatabase()`
- Fixed incorrect reference to `process`, which can break apps in some environments (e.g. webpack5)
- [SQLite] [JSI] Fixed JSI mode when running on Hermes
- Fixed a race condition when using standard fetch methods alongside `Collection.unsafeFetchRecordsWithSQL` - @jspizziri
- withObservables shouldn't cause any RxJS issues anymore as it no longer imports RxJS
- [Typescript] Added `onSetUpError` and `onIndexedDBFetchStart` fields to `LokiAdapterOptions`; fixes TS error - @3DDario
- [Typescript] Removed duplicated identifiers `useWebWorker` and `useIncrementalIndexedDB` in `LokiAdapterOptions` - @3DDario
- [Typescript] Fix default export in logger util

## 0.21 - 2021-03-24

### BREAKING CHANGES

- [LokiJS] `useWebWorker` and `useIncrementalIndexedDB` options are now required (previously, skipping them would only trigger a warning)

### New features

- [Model] `Model.update` method now returns updated record
- [adapters] `onSetUpError: Error => void` option is added to both `SQLiteAdapter` and `LokiJSAdapter`. Supply this option to catch initialization errors and offer the user to reload or log out
- [LokiJS] new `extraLokiOptions` and `extraIncrementalIDBOptions` options
- [Android] Autolinking is now supported.
  - If You upgrade to `<= v0.21.0` **AND** are on a version of React Native which supports Autolinking, you will need to remove the config manually linking WatermelonDB.
  - You can resolve this issue by **REMOVING** the lines of config from your project which are _added_ in the `Manual Install ONLY` section of the [Android Install docs](https://nozbe.github.io/WatermelonDB/Installation.html#android-react-native).

### Performance

- [LokiJS] Improved performance of launching the app

### Changes

- [LokiJS] `useWebWorker: true` and `useIncrementalIndexedDB: false` options are now deprecated. If you rely on these features, please file an issue!
- [Sync] Optional `log` passed to sync now has more helpful diagnostic information
- [Sync] Open-sourced a simple SyncLogger you can optionally use. See docs for more info.
- [SQLiteAdapter] `synchronous:true` option is now deprecated and will be replaced with `experimentalUseJSI: true` in the future. Please test if your app compiles and works well with `experimentalUseJSI: true`, and if not - file an issue!
- [LokiJS] Changed default autosave interval from 250 to 500ms
- [Typescript] Add `experimentalNestedJoin` definition and `unsafeSqlExpr` clause

### Fixes

- [LokiJS] Fixed a case where IndexedDB could get corrupted over time
- [Resilience] Added extra diagnostics for when you encounter the `Record ID aa#bb was sent over the bridge, but it's not cached` error and a recovery path (LokiJSAdapter-only). Please file an issue if you encounter this issue!
- [Typescript] Fixed type on OnFunction to accept `and` in join
- [Typescript] Fixed type `database#batch(records)`'s argument `records` to accept mixed types

### Internal

- Added an experimental mode where a broken database state is detected, further mutations prevented, and the user notified

## 0.20 - 2020-10-05

### BREAKING CHANGES

This release has unintentionally broken RxJS for some apps using `with-observables`. If you have this issue, please update `@nozbe/with-observables` to the latest version.

### New features

- [Sync] Conflict resolution can now be customized. See docs for more details
- [Android] Autolinking is now supported
- [LokiJS] Adapter autosave option is now configurable

### Changes

- Interal RxJS imports have been refactor such that rxjs-compat should never be used now
- [Performance] Tweak Babel config to produce smaller code
- [Performance] LokiJS-based apps will now take up to 30% less time to load the database (id and unique indicies are generated lazily)

### Fixes

- [iOS] Fixed crash on database reset in apps linked against iOS 14 SDK
- [LokiJS] Fix `Q.like` being broken for multi-line strings on web
- Fixed warn "import cycle" from DialogProvider (#786) by @gmonte.
- Fixed cache date as instance of Date (#828) by @djorkaeffalexandre.

## 0.19 - 2020-08-17

### New features

- [iOS] Added CocoaPods support - @leninlin
- [NodeJS] Introducing a new SQLite Adapter based integration to NodeJS. This requires a
peer dependency on [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3)
and should work with the same configuration as iOS/Android - @sidferreira
- [Android] `exerimentalUseJSI` option has been enabled on Android. However, it requires some app-specific setup which is not yet documented - stay tuned for upcoming releases
- [Schema] [Migrations] You can now pass `unsafeSql` parameters to schema builder and migration steps to modify SQL generated to set up the database or perform migrations. There's also new `unsafeExecuteSql` migration step. Please use this only if you know what you're doing — you shouldn't need this in 99% of cases. See Schema and Migrations docs for more details
- [LokiJS] [Performance] Added experimental `onIndexedDBFetchStart` and `indexedDBSerializer` options to `LokiJSAdapter`. These can be used to improve app launch time. See `src/adapters/lokijs/index.js` for more details.

### Changes

- [Performance] findAndObserve is now able to emit a value synchronously. By extension, this makes Relations put into withObservables able to render the child component in one shot. Avoiding the extra unnecessary render cycles avoids a lot of DOM and React commit-phase work, which can speed up loading some views by 30%
- [Performance] LokiJS is now faster (refactored encodeQuery, skipped unnecessary clone operations)

## 0.18 - 2020-06-30

Another WatermelonDB release after just a week? Yup! And it's jam-packed full of features!

### New features

- [Query] `Q.on` queries are now far more flexible. Previously, they could only be placed at the top
    level of a query. See Docs for more details. Now, you can:

     - Pass multiple conditions on the related query, like so:

        ```js
        collection.query(
          Q.on('projects', [
            Q.where('foo', 'bar'),
            Q.where('bar', 'baz'),
          ])
        )
        ```
     - You can place `Q.on` deeper inside the query (nested inside `Q.and()`, `Q.or()`). However, you
        must explicitly list all tables you're joining on at the beginning of a query, using:
        `Q.experimentalJoinTables(['join_table1', 'join_table2'])`.
     - You can nest `Q.on` conditions inside `Q.on`, e.g. to make a condition on a grandchild.
          To do so, it's required to pass `Q.experimentalNestedJoin('parent_table', 'grandparent_table')` at the beginning
          of a query
- [Query] `Q.unsafeSqlExpr()` and `Q.unsafeLokiExpr()` are introduced to allow adding bits of queries
    that are not supported by the WatermelonDB query language without having to use `unsafeFetchRecordsWithSQL()`.
    See docs for more details
- [Query] `Q.unsafeLokiFilter((rawRecord, loki) => boolean)` can now be used as an escape hatch to make
    queries with LokiJSAdapter that are not otherwise possible (e.g. multi-table column comparisons).
    See docs for more details

### Changes

- [Performance] [LokiJS] Improved performance of queries containing query comparisons on LokiJSAdapter
- [Docs] Added Contributing guide for Query language improvements
- [Deprecation] `Query.hasJoins` is deprecated
- [DX] Queries with bad associations now show more helpful error message
- [Query] Counting queries that contain `Q.experimentalTake` / `Q.experimentalSkip` is currently broken - previously it would return incorrect results, but
    now it will throw an error to avoid confusion. Please contribute to fix the root cause!

### Fixes

- [Typescript] Fixed types of Relation

### Internal

- `QueryDescription` structure has been changed.

## 0.17.1 - 2020-06-24

- Fixed broken iOS build - @mlecoq

## 0.17 - 2020-06-22

### New features

- [Sync] Introducing Migration Syncs - this allows fully consistent synchronization when migrating
      between schema versions. Previously, there was no mechanism to incrementally fetch all remote changes in
      new tables and columns after a migration - so local copy was likely inconsistent, requiring a re-login.
      After adopting migration syncs, Watermelon Sync will request from backend all missing information.
      See Sync docs for more details.
- [iOS] Introducing a new native SQLite database integration, rewritten from scratch in C++, based
       on React Native's JSI (JavaScript Interface). It is to be considered experimental, however
       we intend to make it the default (and eventually, the only) implementation. In a later release,
       Android version will be introduced.

       The new adapter is up to 3x faster than the previously fastest `synchronous: true` option,
       however this speedup is only achieved with some unpublished React Native patches.

       To try out JSI, add `experimentalUseJSI: true` to `SQLiteAdapter` constructor.
- [Query] Added `Q.experimentalSortBy(sortColumn, sortOrder)`, `Q.experimentalTake(count)`,
     `Q.experimentalSkip(count)` methods (only availble with SQLiteAdapter) - @Kenneth-KT
- `Database.batch()` can now be called with a single array of models
- [DX] `Database.get(tableName)` is now a shortcut for `Database.collections.get(tableName)`
- [DX] Query is now thenable - you can now use `await query` and `await query.count` instead of `await query.fetch()` and `await query.fetchCount()`
- [DX] Relation is now thenable - you can now use `await relation` instead of `await relation.fetch()`
- [DX] Exposed `collection.db` and `model.db` as shortcuts to get to their Database object

### Changes

- [Hardening] Column and table names starting with `__`, Object property names (e.g. `constructor`), and some reserved keywords are now forbidden
- [DX] [Hardening] QueryDescription builder methods do tighter type checks, catching more bugs, and
  preventing users from unwisely passing unsanitized user data into Query builder methods
- [DX] [Hardening] Adapters check early if table names are valid
- [DX] Collection.find reports an error more quickly if an obviously invalid ID is passed
- [DX] Intializing Database with invalid model classes will now show a helpful error
- [DX] DatabaseProvider shows a more helpful error if used improperly
- [Sync] Sync no longer fails if pullChanges returns collections that don't exist on the frontend - shows a warning instead. This is to make building backwards-compatible backends less error-prone
- [Sync] [Docs] Sync documentation has been rewritten, and is now closer in detail to a formal specification
- [Hardening] database.collections.get() better validates passed value
- [Hardening] Prevents unsafe strings from being passed as column name/table name arguments in QueryDescription

### Fixes

- [Sync] Fixed `RangeError: Maximum call stack size exceeded` when syncing large amounts of data - @leninlin
- [iOS] Fixed a bug that could cause a database operation to fail with an (6) SQLITE_LOCKED error
- [iOS] Fixed 'jsi/jsi.h' file not found when building at the consumer level. Added path `$(SRCROOT)/../../../../../ios/Pods/Headers/Public/React-jsi` to Header Search Paths (issue #691) - @victorbutler
- [Native] SQLite keywords used as table or column names no longer crash
- Fixed potential issues when subscribing to database, collection, model, queries passing a subscriber function with the same identity more than once

### Internal

- Fixed broken adapter tests

## 0.15.1, 0.16.1-fix, 0.16.2 - 2020-06-03

This is a security patch for a vulnerability that could cause maliciously crafted record IDs to
cause all or some of user's data to be deleted. More information available via GitHub security advisory

## 0.16.1 - 2020-05-18

### Changes

- `Database.unsafeResetDatabase()` is now less unsafe — more application bugs are being caught

### Fixes

- [iOS] Fix build in apps using Flipper
- [Typescript] Added type definition for `setGenerator`.
- [Typescript] Fixed types of decorators.
- [Typescript] Add Tests to test Types.
- Fixed typo in learn-to-use docs.
- [Typescript] Fixed types of changes.

### Internal

- [SQLite] Infrastruture for a future JSI adapter has been added

## 0.16 - 2020-03-06

### ⚠️ Breaking

- `experimentalUseIncrementalIndexedDB` has been renamed to `useIncrementalIndexedDB`

#### Low breakage risk

- [adapters] Adapter API has changed from returning Promise to taking callbacks as the last argument. This won't affect you unless you call on adapter methods directly. `database.adapter` returns a new `DatabaseAdapterCompat` which has the same shape as old adapter API. You can use `database.adapter.underlyingAdapter` to get back `SQLiteAdapter` / `LokiJSAdapter`
- [Collection] `Collection.fetchQuery` and `Collection.fetchCount` are removed. Please use `Query.fetch()` and `Query.fetchCount()`.

### New features

- [SQLiteAdapter] [iOS] Add new `synchronous` option to adapter: `new SQLiteAdapter({ ..., synchronous: true })`.
  When enabled, database operations will block JavaScript thread. Adapter actions will resolve in the
  next microtask, which simplifies building flicker-free interfaces. Adapter will fall back to async
  operation when synchronous adapter is not available (e.g. when doing remote debugging)
- [LokiJS] Added new `onQuotaExceededError?: (error: Error) => void` option to `LokiJSAdapter` constructor.
  This is called when underlying IndexedDB encountered a quota exceeded error (ran out of allotted disk space for app)
  This means that app can't save more data or that it will fall back to using in-memory database only
  Note that this only works when `useWebWorker: false`

### Changes

- [Performance] Watermelon internals have been rewritten not to rely on Promises and allow some fetch/observe calls to resolve synchronously. Do not rely on this -- external API is still based on Rx and Promises and may resolve either asynchronously or synchronously depending on capabilities. This is meant as a internal performance optimization only for the time being.
- [LokiJS] [Performance] Improved worker queue implementation for performance
- [observation] Refactored observer implementations for performance

### Fixes

- Fixed a possible cause for "Record ID xxx#yyy was sent over the bridge, but it's not cached" error
- [LokiJS] Fixed an issue preventing database from saving when using `experimentalUseIncrementalIndexedDB`
- Fixed a potential issue when using `database.unsafeResetDatabase()`
- [iOS] Fixed issue with clearing database under experimental synchronous mode

### New features (Experimental)

- [Model] Added experimental `model.experimentalSubscribe((isDeleted) => { ... })` method as a vanilla JS alternative to Rx based `model.observe()`. Unlike the latter, it does not notify the subscriber immediately upon subscription.
- [Collection] Added internal `collection.experimentalSubscribe((changeSet) => { ... })` method as a vanilla JS alternative to Rx based `collection.changes` (you probably shouldn't be using this API anyway)
- [Database] Added experimental `database.experimentalSubscribe(['table1', 'table2'], () => { ... })` method as a vanilla JS alternative to Rx-based `database.withChangesForTables()`. Unlike the latter, `experimentalSubscribe` notifies the subscriber only once after a batch that makes a change in multiple collections subscribed to. It also doesn't notify the subscriber immediately upon subscription, and doesn't send details about the changes, only a signal.
- Added `experimentalDisableObserveCountThrottling()` to `@nozbe/watermelondb/observation/observeCount` that globally disables count observation throttling. We think that throttling on WatermelonDB level is not a good feature and will be removed in a future release - and will be better implemented on app level if necessary
- [Query] Added experimental `query.experimentalSubscribe(records => { ... })`, `query.experimentalSubscribeWithColumns(['col1', 'col2'], records => { ... })`, and `query.experimentalSubscribeToCount(count => { ... })` methods

## 0.15 - 2019-11-08

### Highlights

This is a **massive** new update to WatermelonDB! 🍉

- **Up to 23x faster sync**. You heard that right. We've made big improvements to performance.
  In our tests, with a massive sync (first login, 45MB of data / 65K records) we got a speed up of:
  - 5.7s -> 1.2s on web (5x)
  - 142s -> 6s on iOS (23x)

  Expect more improvements in the coming releases!
- **Improved LokiJS adapter**. Option to disable web workers, important Safari 13 fix, better performance,
  and now works in Private Modes. We recommend adding `useWebWorker: false, experimentalUseIncrementalIndexedDB: true` options to the `LokiJSAdapter` constructor to take advantage of the improvements, but please read further changelog to understand the implications of this.
- **Raw SQL queries** now available on iOS and Android thanks to the community
- **Improved TypeScript support** — thanks to the community

### ⚠️ Breaking

- Deprecated `bool` schema column type is removed -- please change to `boolean`
- Experimental `experimentalSetOnlyMarkAsChangedIfDiffers(false)` API is now removed

### New featuers

- [Collection] Add `Collection.unsafeFetchRecordsWithSQL()` method. You can use it to fetch record using
  raw SQL queries on iOS and Android. Please be careful to avoid SQL injection and other pitfalls of
  raw queries
- [LokiJS] Introduces new `new LokiJSAdapter({ ..., experimentalUseIncrementalIndexedDB: true })` option.
  When enabled, database will be saved to browser's IndexedDB using a new adapter that only saves the
  changed records, instead of the entire database.

  **This works around a serious bug in Safari 13** (https://bugs.webkit.org/show_bug.cgi?id=202137) that causes large
  databases to quickly balloon to gigabytes of temporary trash

  This also improves performance of incremental saves, although initial page load or very, very large saves
  might be slightly slower.

  This is intended to become the new default option, but it's not backwards compatible (if enabled, old database
  will be lost). **You're welcome to contribute an automatic migration code.**

  Note that this option is still experimental, and might change in breaking ways at any time.

- [LokiJS] Introduces new `new LokiJSAdapter({ ..., useWebWorker: false })` option. Before, web workers
  were always used with `LokiJSAdapter`. Although web workers may have some performance benefits, disabling them
  may lead to lower memory consumption, lower latency, and easier debugging. YMMV.
- [LokiJS] Added `onIndexedDBVersionChange` option to `LokiJSAdapter`. This is a callback that's called
  when internal IDB version changed (most likely the database was deleted in another browser tab).
  Pass a callback to force log out in this copy of the app as well. Note that this only works when
  using incrementalIDB and not using web workers
- [Model] Add `Model._dangerouslySetRawWithoutMarkingColumnChange()` method. You probably shouldn't use it,
  but if you know what you're doing and want to live-update records from server without marking record as updated,
  this is useful
- [Collection] Add `Collection.prepareCreateFromDirtyRaw()`
- @json decorator sanitizer functions take an optional second argument, with a reference to the model

### Fixes

- Pinned required `rambdax` version to 2.15.0 to avoid console logging bug. In a future release we will switch to our own fork of `rambdax` to avoid future breakages like this.

### Improvements

- [Performance] Make large batches a lot faster (1.3s shaved off on a 65K insert sample)
- [Performance] [iOS] Make large batch inserts an order of magnitude faster
- [Performance] [iOS] Make encoding very large queries (with thousands of parameters) 20x faster
- [Performance] [LokiJS] Make batch inserts faster (1.5s shaved off on a 65K insert sample)
- [Performance] [LokiJS] Various performance improvements
- [Performance] [Sync] Make Sync faster
- [Performance] Make observation faster
- [Performance] [Android] Make batches faster
- Fix app glitches and performance issues caused by race conditions in `Query.observeWithColumns()`
- [LokiJS] Persistence adapter will now be automatically selected based on availability. By default,
  IndexedDB is used. But now, if unavailable (e.g. in private mode), ephemeral memory adapter will be used.
- Disabled console logs regarding new observations (it never actually counted all observations) and
  time to query/count/batch (the measures were wildly inaccurate because of asynchronicity - actual
  times are much lower)
- [withObservables] Improved performance and debuggability (update withObservables package separately)
- Improved debuggability of Watermelon -- shortened Rx stacks and added function names to aid in understanding
  call stacks and profiles
- [adapters] The adapters interface has changed. `query()` and `count()` methods now receive a `SerializedQuery`, and `batch()` now takes `TableName<any>` and `RawRecord` or `RecordId` instead of `Model`.
- [Typescript] Typing improvements
     - Added 3 missing properties `collections`, `database` and `asModel` in Model type definition.
     - Removed optional flag on `actionsEnabled` in the Database constructor options since its mandatory since 0.13.0.
     - fixed several further typing issues in Model, Relation and lazy decorator
- Changed how async functions are transpiled in the library. This could break on really old Android phones
  but shouldn't matter if you use latest version of React Native. Please report an issue if you see a problem.
- Avoid `database` prop drilling in the web demo

## 0.14.1 - 2019-08-31

Hotfix for rambdax crash

- [Schema] Handle invalid table schema argument in appSchema
- [withObservables] Added TypeScript support ([changelog](https://github.com/Nozbe/withObservables/blob/master/CHANGELOG.md))
- [Electron] avoid `Uncaught ReferenceError: global is not defined` in electron runtime ([#453](https://github.com/Nozbe/WatermelonDB/issues/453))
- [rambdax] Replaces `contains` with `includes` due to `contains` deprecation https://github.com/selfrefactor/rambda/commit/1dc1368f81e9f398664c9d95c2efbc48b5cdff9b#diff-04c6e90faac2675aa89e2176d2eec7d8R2209

## 0.14.0 - 2019-08-02

### New features
- [Query] Added support for `notLike` queries 🎉
- [Actions] You can now batch delete record with all descendants using experimental functions `experimentalMarkAsDeleted` or `experimentalDestroyPermanently`

## 0.13.0 - 2019-07-18

### ⚠️ Breaking

- [Database] It is now mandatory to pass `actionsEnabled:` option to Database constructor.
     It is recommended that you enable this option:

     ```js
     const database = new Database({
       adapter: ...,
       modelClasses: [...],
       actionsEnabled: true
     })
     ```

     See `docs/Actions.md` for more details about Actions. You can also pass `false` to maintain
     backward compatibility, but this option **will be removed** in a later version
- [Adapters] `migrationsExperimental` prop of `SQLiteAdapter` and `LokiJSAdapter` has been renamed
    to `migrations`.

### New features
- [Actions] You can now batch deletes by using `prepareMarkAsDeleted` or `prepareDestroyPermanently`
- [Sync] Performance: `synchronize()` no longer calls your `pushChanges()` function if there are no
    local changes to push. This is meant to save unnecessary network bandwidth. ⚠️ Note that this
    could be a breaking change if you rely on it always being called
- [Sync] When setting new values to fields on a record, the field (and record) will no longer be
    marked as changed if the field's value is the same. This is meant to improve performance and avoid
    unnecessary code in the app. ⚠️ Note that this could be a breaking change if you rely on the old
    behavior. For now you can import `experimentalSetOnlyMarkAsChangedIfDiffers` from
    `@nozbe/watermelondb/Model/index` and call if with `(false)` to bring the old behavior back, but
    this will be removed in the later version -- create a new issue explaining why you need this
- [Sync] Small perf improvements

### Improvements
- [Typescript] Improved types for SQLite and LokiJS adapters, migrations, models, the database and the logger.

## 0.12.3 - 2019-05-06

### Changes

- [Database] You can now update the random id schema by importing
    `import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'` and then calling `setGenerator(newGenenerator)`.
    This allows WatermelonDB to create specific IDs for example if your backend uses UUIDs.
- [Typescript] Type improvements to SQLiteAdapter and Database
- [Tests] remove cleanup for react-hooks-testing-library@0.5.0 compatibility

## 0.12.2 - 2019-04-19

### Fixes

- [TypeScript] 'Cannot use 'in' operator to search for 'initializer'; decorator fix

### Changes
- [Database] You can now pass falsy values to `Database.batch(...)` (false, null, undefined). This is
    useful in keeping code clean when doing operations conditionally. (Also works with `model.batch(...)`)
- [Decorators]. You can now use `@action` on methods of any object that has a `database: Database`
     property, and `@field @children @date @relation @immutableRelation @json @text @nochange` decorators on
     any object with a `asModel: Model` property.
- [Sync] Adds a temporary/experimental `_unsafeBatchPerCollection: true` flag to `synchronize()`. This
     causes server changes to be committed to database in multiple batches, and not one. This is NOT preferred
     for reliability and performance reasons, but it works around a memory issue that might cause your app
     to crash on very large syncs (>20,000 records). Use this only if necessary. Note that this option
     might be removed at any time if a better solution is found.

## 0.12.1 - 2019-04-01

### ⚠️ Hotfix

- [iOS] Fix runtime crash when built with Xcode 10.2 (Swift 5 runtime).

    **⚠️ Note**: You need to upgrade to React Native 0.59.3 for this to work. If you can't upgrade
    React Native yet, either stick to Xcode 10.1 or manually apply this patch:
    https://github.com/Nozbe/WatermelonDB/pull/302/commits/aa4e08ad0fa55f434da2a94407c51fc5ff18e506

### Changes

- [Sync] Adds basic sync logging capability to Sync. Pass an empty object to `synchronize()` to populate it with diagnostic information:
    ```js
    const log = {}
    await synchronize({ database, log, ...})
    console.log(log.startedAt)
    ```
    See Sync documentation for more details.

## 0.12.0 - 2019-03-18

### Added

- [Hooks] new `useDatabase` hook for consuming the Database Context:
   ```js
   import { useDatabase } from '@nozbe/watermelondb/hooks';
   const Component = () => {
      const database = useDatabase();
   }
   ```
- [TypeScript] added `.d.ts` files. Please note: TypeScript definitions are currently incomplete and should be used as a guide only. **PRs for improvements would be greatly appreciated!**

### Performance

- Improved UI performance by consolidating multiple observation emissions into a single per-collection batch emission when doing batch changes

## 0.11.0 - 2019-03-12

### Breaking

- ⚠️ Potentially BREAKING fix: a `@date` field now returns a Jan 1, 1970 date instead of `null` if the field's raw value is `0`.
   This is considered a bug fix, since it's unexpected to receive a `null` from a getter of a field whose column schema doesn't say `isOptional: true`.
   However, if you relied on this behavior, this might be a breaking change.
- ⚠️ BREAKING: `Database.unsafeResetDatabase()` now requires that you run it inside an Action

### Bug fixes

- [Sync] Fixed an issue where synchronization would continue running despite `unsafeResetDatabase` being called
- [Android] fix compile error for kotlin 1.3+

### Other changes

- Actions are now aborted when `unsafeResetDatabase()` is called, making reseting database a little bit safer
- Updated demo dependencies
- LokiJS is now a dependency of WatermelonDB (although it's only required for use on the web)
- [Android] removed unused test class
- [Android] updated ktlint to `0.30.0`

## 0.10.1 - 2019-02-12

### Changes

- [Android] Changed `compile` to `implementation` in Library Gradle file
  - ⚠️ might break build if you are using Android Gradle Plugin <3.X
- Updated `peerDependency` `react-native` to `0.57.0`
- [Sync] Added `hasUnsyncedChanges()` helper method
- [Sync] Improved documentation for backends that can't distinguish between `created` and `updated` records
- [Sync] Improved diagnostics / protection against edge cases
- [iOS] Add missing `header search path` to support **ejected** expo project.
- [Android] Fix crash on android < 5.0
- [iOS] `SQLiteAdapter`'s `dbName` path now allows you to pass an absolute path to a file, instead of a name
- [Web] Add adaptive layout for demo example with smooth scrolling for iOS

## 0.10.0 - 2019-01-18

### Breaking

- **BREAKING:** Table column `last_modified` is no longer automatically added to all database tables. If
  you don't use this column (e.g. in your custom sync code), you don't have to do anything.
  If you do, manually add this column to all table definitions in your Schema:
  ```
  { name: 'last_modified', type: 'number', isOptional: true }
  ```
  **Don't** bump schema version or write a migration for this.

### New

- **Actions API**.

  This was actually released in 0.8.0 but is now documented in [CRUD.md](./docs/CRUD.md) and [Actions.md](./docs/Actions.md).
  With Actions enabled, all create/update/delete/batch calls must be wrapped in an Action.

  To use Actions, call `await database.action(async () => { /* perform writes here */ }`, and in
  Model instance methods, you can just decorate the whole method with `@action`.

  This is necessary for Watermelon Sync, and also to enable greater safety and consistency.

  To enable actions, add `actionsEnabled: true` to `new Database({ ... })`. In a future release this
  will be enabled by default, and later, made mandatory.

  See documentation for more details.
- **Watermelon Sync Adapter** (Experimental)

  Added `synchronize()` function that allows you to easily add full synchronization capabilities to
  your Watermelon app. You only need to provide two fetch calls to your remote server that conforms
  to Watermelon synchronization protocol, and all the client-side processing (applying remote changes,
  resolving conflicts, finding local changes, and marking them as synced) is done by Watermelon.

  See documentation for more details.

- **Support caching for non-global IDs at Native level**

## 0.9.0 - 2018-11-23

### New

- Added `Q.like` - you can now make queries similar to SQL `LIKE`

## 0.8.0 - 2018-11-16

### New

- Added `DatabaseProvider` and `withDatabase` Higher-Order Component to reduce prop drilling
- Added experimental Actions API. This will be documented in a future release.

### Fixes

- Fixes crash on older Android React Native targets without `jsc-android` installed

## 0.7.0 - 2018-10-31

### Deprecations

- [Schema] Column type 'bool' is deprecated — change to 'boolean'

### New

- Added support for Schema Migrations. See documentation for more details.
- Added fundaments for integration of Danger with Jest

### Changes

- Fixed "dependency cycle" warning
- [SQLite] Fixed rare cases where database could be left in an unusable state (added missing transaction)
- [Flow] Fixes `oneOf()` typing and some other variance errors
- [React Native] App should launch a little faster, because schema is only compiled on demand now
- Fixed typos in README.md
- Updated Flow to 0.85

## 0.6.2 - 2018-10-04

### Deprecations

- The `@nozbe/watermelondb/babel/cjs` / `@nozbe/watermelondb/babel/esm` Babel plugin that ships with Watermelon is deprecated and no longer necessary. Delete it from your Babel config as it will be removed in a future update

### Refactoring

- Removed dependency on `async` (Web Worker should be ~30KB smaller)
- Refactored `Collection` and `simpleObserver` for getting changes in an array and also adds CollectionChangeTypes for differentiation between different changes
- Updated dependencies
- Simplified build system by using relative imports
- Simplified build package by outputting CJS-only files

## 0.6.1 - 2018-09-20

### Added

- Added iOS and Android integration tests and lint checks to TravisCI

### Changed

- Changed Flow setup for apps using Watermelon - see docs/Advanced/Flow.md
- Improved documentation, and demo code
- Updated dependencies

### Fixed

- Add quotes to all names in sql queries to allow keywords as table or column names
- Fixed running model tests in apps with Watermelon in the loop
- Fixed Flow when using Watermelon in apps

## 0.6.0 - 2018-09-05

Initial release of WatermelonDB
