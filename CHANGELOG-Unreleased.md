# Changelog

## Unreleased

### BREAKING CHANGES

- [Query] `Q.where(xxx, undefined)` will now throw an error. This is a bug fix, since comparing to
  undefined was never allowed and would either error out or produce a wrong result in some cases.
  However, it could technically break an app that relied on existing buggy behavior

### Deprecations

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

### Internal
