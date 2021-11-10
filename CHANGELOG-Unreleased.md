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
- [Query] Added experimental `query.experimentalFetchColumns(['col1', 'col2'])` and `query.experimentalObserveColumns(['col1', 'col2'])` and methods to fetch and observe on record states with only the selected columns.

### Performance

- [LokiJS] Updated Loki with some performance improvements
- [iOS] JSLockPerfHack now works on iOS 15
- Improved `@json` decorator, now with optional `{ memo: true }` parameter

### Changes

### Fixes

- [android] Fixed compilation on some setups due to a missing <cassert> import
- [sync] Fixed marking changes as synced for users that don't keep globally unique (only per-table unique) IDs

### Internal
