# Changelog

## Unreleased

### BREAKING CHANGES
- [LokiJS] `useWebWorker` and `useIncrementalIndexedDB` options are now required (previously, skipping them would only trigger a warning)

### Deprecations
- [LokiJS] `Q.unsafeLokiFilter` is now deprecated and will be removed in a future version.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.

### New features
- [Model] `Model.update` method now returns updated record
- [adapters] `onSetUpError: Error => void` option is added to both `SQLiteAdapter` and `LokiJSAdapter`. Supply this option to catch initialization errors and offer the user to reload or log out
- [LokiJS] New `Q.unsafeLokiTransform` operation. It's an enhanced version of `Q.unsafeLokiFilter` which also allows full-array operations, such as sorting, or passing to a library that expects a full array (e.g. fuzzy search libraries)
- [LokiJS] new `extraLokiOptions` and `extraIncrementalIDBOptions` options
- [Android] Autolinking is now supported (v0.20 is insufficient)

### Performance
- [LokiJS] Improved performance of launching the app
- Removed dependency on rambdax and made the util library smaller to keep

### Changes

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
-
