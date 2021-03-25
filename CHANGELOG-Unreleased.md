# Changelog

## Unreleased

### BREAKING CHANGES

### Deprecations

- [LokiJS] `Q.unsafeLokiFilter` is now deprecated and will be removed in a future version.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.

### New features

### Performance

- Removed dependency on rambdax and made the util library smaller

### Changes

- [Docs] Add advanced tutorial to share database across iOS targets - @thiagobrez
- [Sqlite] Allowed callbacks (within the migrationEvents object) to be passed so as to track the migration events status ( onStart, onSuccess, onError ) - @avinashlng1080
- [Sqlite] Added a dev-only `Query._sql()` method for quickly extracting SQL from Queries for debugging purposes

### Fixes

- Fixed incorrect reference to `process`, which can break apps in some environments (e.g. webpack5)
- Fixed a race condition when using standard fetch methods alongside `Collection.unsafeFetchRecordsWithSQL` - @jspizziri

### Internal
