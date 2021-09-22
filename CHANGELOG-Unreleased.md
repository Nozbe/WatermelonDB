# Changelog

## Unreleased

### BREAKING CHANGES

- `Q.experimentalSortBy`, `Q.experimentalSkip`, `Q.experimentalTake` have been renamed to `Q.sortBy`, `Q.skip`, `Q.take` respectively
- **RxJS has been updated to 7.3.0**. If you're not importing from `rxjs` in your app, this doesn't apply to you. If you are, read RxJS 7 breaking changes: https://rxjs.dev/deprecations/breaking-changes

### Deprecations

### New features

- **sortBy, skip, take** are now available in LokiJSAdapter as well
- [Sync] `experimentalRejectedIds` parameter now available in push response to allow partial rejection of an otherwise successful sync

### Performance

### Changes

### Fixes

- Fixes an issue when using Headless JS on Android with JSI mode enabled - pass `usesExclusiveLocking: true` to SQLiteAdapter to enable
- Fixes Typescript annotations for Collection and adapters/sqlite

### Internal
