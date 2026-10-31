### Highlights

### BREAKING CHANGES

### Deprecations

### New features

- [LokiJS] New `onPersistenceError` option: called when saving the database to IndexedDB fails (e.g. quota exceeded, aborted transaction), once per failure. Quota exceeded save errors are now also passed to `onQuotaExceededError`
- [LokiJS] New `allowInMemoryFallback` option (default: `true`). Pass `false` to make setup fail (and `onSetUpError` be called) instead of silently falling back to an in-memory database when IndexedDB is unavailable
- [LokiJS] New `onInMemoryFallback` option: called when the database falls back to being in-memory only
### Fixes

- [LokiJS] Multitab sync issue fix
- [LokiJS] When IndexedDB database is deleted in another tab (`onversionchange`), the database is no longer re-created from this tab's memory on next autosave. Instead, the adapter stops saving, rejects further changes, and calls `onPersistenceError`
- [LokiJS] Failures to save the database to IndexedDB are now always logged
- [LokiJS] When accessing or opening IndexedDB throws synchronously (e.g. `SecurityError` when storage access is denied), the adapter now falls back to an in-memory database like for other IndexedDB open failures (or fails setup with `allowInMemoryFallback: false`), instead of always failing setup
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
