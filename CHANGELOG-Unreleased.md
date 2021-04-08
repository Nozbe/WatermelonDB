# Changelog

## Unreleased

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

- Fixed incorrect reference to `process`, which can break apps in some environments (e.g. webpack5)
- [SQLite] [JSI] Fixed JSI mode when running on Hermes
- Fixed a race condition when using standard fetch methods alongside `Collection.unsafeFetchRecordsWithSQL` - @jspizziri
- withObservables shouldn't cause any RxJS issues anymore as it no longer imports RxJS
- [Typescript] Added `onSetUpError` and `onIndexedDBFetchStart` fields to `LokiAdapterOptions`; fixes TS error - @3DDario
- [Typescript] Removed duplicated identifiers `useWebWorker` and `useIncrementalIndexedDB` in `LokiAdapterOptions` - @3DDario

### Internal
