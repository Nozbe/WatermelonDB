# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Breaking

- **BREAKING:** Table column `last_modified` is no longer automatically added to all database tables. If
  you don't use this column (e.g. in your custom sync code), you don't have to do anything.
  If you do, manually add this column to all table definitions in your Schema:
  ```
  { name: 'last_modified', type: 'number', isOptional: true }
  ```
  **Don't** bump schema version or write a migration for this.

### New

- **Actions API**
  This was actually released in 0.8.0 but is now documented in [./docs/CRUD.md][] and [./docs/Actions.md][].
  With Actions enabled, all create/update/delete/batch calls must be wrapped in an Action.

  To use Actions, call `await database.action(async () => { /* perform writes here */ }`, and in
  Model instance methods, you can just decorate the whole method with `@action`.

  This is necessary for Watermelon Sync, and also to enable greater safety and consistency.

  To enable actions, add `actionsEnabled: true` to `new Database({ ... })`. In a future release this
  will be enabled by default, and later, made mandatory.

  See documentation for more details.
- **Watermelon Sync Adapter**
  Added `synchronize()` function that allows you to easily add full synchronization capabilities to
  your Watermelon app. You only need to provide two fetch calls to your remote server that conforms
  to Watermelon synchronization protocol, and all the client-side processing (applying remote changes,
  resolving conflicts, finding local changes, and marking them as synced) is done by Watermelon.

  See documentation for more details.

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
