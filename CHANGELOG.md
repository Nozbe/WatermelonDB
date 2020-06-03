# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### New features

- [iOS] Introducing a new native SQLite database integration, rewritten from scratch in C++, based
       on React Native's JSI (JavaScript Interface). It is to be considered experimental, however
       we intend to make it the default (and eventually, the only) implementation. In a later release,
       Android version will be introduced.

       The new adapter is up to 3x faster than the previously fastest `synchronous: true` option,
       however this speedup is only achieved with some unpublished React Native patches.

       To try out JSI, add `experimentalUseJSI: true` to `SQLiteAdapter` constructor.

### Changes

- [Hardening] Column and table names starting with `__`, Object property names (e.g. `constructor`), and some reserved keywords are now forbidden
- [DX] Intializing Database with invalid model classes will now show a helpful error
- [DX] DatabaseProvider shows a more helpful error if used improperly
- [Sync] Sync no longer fails if pullChanges returns collections that don't exist on the frontend - shows a warning instead. This is to make building backwards-compatible backends less error-prone
- [Hardening] database.collections.get() better validates passed value

### Fixes

- [iOS] Fixed a bug that could cause a database operation to fail with an (6) SQLITE_LOCKED error
- [iOS] Fixed 'jsi/jsi.h' file not found when building at the consumer level. Added path `$(SRCROOT)/../../../../../ios/Pods/Headers/Public/React-jsi` to Header Search Paths (issue #691)

### Internal

- Fixed broken adapter tests

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
