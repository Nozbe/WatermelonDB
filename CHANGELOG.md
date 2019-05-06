# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## Breaking

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

### Changes

## 0.12.3 - 2019-05-06

### Changes

- [Database] You can now update the random id schema by importing `import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId'` and then calling `setGenerator(newGenenerator)`. This allows WatermelonDB to create specific IDs for example if your backend uses UUIDs.
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
