# Changelog

## Unreleased

### BREAKING CHANGES
- [LokiJS] `useWebWorker` and `useIncrementalIndexedDB` options are now required (previously, skipping them would only trigger a warning)
- [Android] Autolinking is now supported.
  - If You upgrade to `<= v0.21.0` **AND** are on a version of React Native which supports Autolinking, you will need to remove the config manually linking WatermelonDB.
  - You can resolve this issue by **REMOVING** the lines of config from your project which are _added_ in the `Manual Install ONLY
` section of the [Android Install docs](https://nozbe.github.io/WatermelonDB/Installation.html#android-react-native).

### New features
- [Model] `Model.update` method now returns updated record
- [adapters] `onSetUpError: Error => void` option is added to both `SQLiteAdapter` and `LokiJSAdapter`. Supply this option to catch initialization errors and offer the user to reload or log out
- [LokiJS] new `extraLokiOptions` and `extraIncrementalIDBOptions` options

### Performance

### Changes

- [Sync] Optional `log` passed to sync now has more helpful diagnostic information
- [Sync] Open-sourced a simple SyncLogger you can optionally use. See docs for more info.
- [SQLiteAdapter] `synchronous:true` option is now deprecated and will be replaced with `experimentalUseJSI: true` in the future. Please test if your app compiles and works well with `experimentalUseJSI: true`, and if not - file an issue!
- [LokiJS] Changed default autosave interval from 250 to 500ms
- [Typescript] Add `experimentalNestedJoin` definition and `unsafeSqlExpr` clause

### Fixes

- [Resilience] Added extra diagnostics for when you encounter the `Record ID aa#bb was sent over the bridge, but it's not cached` error and a recovery path (LokiJSAdapter-only). Please file an issue if you encounter this issue!
- [Typescript] Fixed type on OnFunction to accept `and` in join
- [Typescript] Fixed type `database#batch(records)`'s argument `records` to accept mixed types

### Internal

- Added an experimental mode where a broken database state is detected, further mutations prevented, and the user notified
- Added an experimental mode that attempts to fix IndexedDB corruption issue & improves launch performance
