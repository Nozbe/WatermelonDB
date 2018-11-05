# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.7.0 - 2018-10-31

### Deprecations

- [Schema] Column type 'bool' is deprecated — change to 'boolean'

### New

- Added support for Schema Migrations. See documentation for more details.

### Changes

- Fixed "dependency cycle" warning
- [SQLite] Fixed rare cases where database could be left in an unusable state (added missing transaction)
- [Flow] Fixes `oneOf()` typing and some other variance errors
- [React Native] App should launch a little faster, because schema is only compiled on demand now
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
