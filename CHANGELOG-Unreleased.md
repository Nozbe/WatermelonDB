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

- [Sync] Columns set while creating a record (`collection.create()` builder) are now recorded in its `_changed` field. When a pull contains a record with the same id as a locally created, not yet pushed one, conflicts are now resolved per column (locally set columns win) instead of the remote version winning. A custom `conflictResolver` receives this per-column result as `resolved`. `_changed` is also included in pushed `created` records; it's reset when the record is marked as synced
- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
