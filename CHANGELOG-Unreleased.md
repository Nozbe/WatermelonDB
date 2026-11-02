### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1
- [Sync] With `_unsafeBatchPerCollection`, pulled changes are now committed in batches one after another (each prepared right before it is committed) instead of all at once, so a failed batch leaves the following ones untouched. Observers are notified once per pull instead of once per table and batch
- `database.experimentalBatchNotifications()` now merges all changes made within it into one notification (one call per `experimentalSubscribe` subscriber, one emission per changed collection) instead of replaying one notification per batch

### Internal

- Updated internal dependencies
- Updated documentation scripts
