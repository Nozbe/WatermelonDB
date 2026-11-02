### Highlights

### BREAKING CHANGES

### Deprecations

### New features

- [LokiJS] New `onPersistenceError` option: called when saving the database to IndexedDB fails (e.g. quota exceeded, aborted transaction), once per failure. Quota exceeded save errors are now also passed to `onQuotaExceededError`
- [LokiJS] New `allowInMemoryFallback` option (default: `true`). Pass `false` to make setup fail (and `onSetUpError` be called) instead of silently falling back to an in-memory database when IndexedDB is unavailable
- [LokiJS] New `onInMemoryFallback` option: called when the database falls back to being in-memory only
- [LokiJS] New opt-in `exclusiveLock` option: only one browser tab at a time has the database open (using the Web Locks API), so tabs no longer overwrite each other's changes or undo a reset done in another tab. Other tabs wait until it's closed, and `onDatabaseLockedElsewhere` is called. Without the Web Locks API, the database is opened without a lock
### Fixes

- [LokiJS] Multitab sync issue fix
- [LokiJS] When IndexedDB database is deleted in another tab (`onversionchange`), the database is no longer re-created from this tab's memory on next autosave. Instead, the adapter stops saving, rejects further changes, and calls `onPersistenceError`
- [LokiJS] Failures to save the database to IndexedDB are now always logged
- [LokiJS] After the database stops being saved (e.g. it was deleted in another tab), callbacks waiting for a save that was in progress (from `close()` or `unsafeResetDatabase()`) are now called with an error instead of never being called
- [LokiJS] When accessing or opening IndexedDB throws synchronously (e.g. `SecurityError` when storage access is denied), the adapter now falls back to an in-memory database like for other IndexedDB open failures (or fails setup with `allowInMemoryFallback: false`), instead of always failing setup
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript
- [LokiJS] Fixed `unsafeResetDatabase()` failing with "another operation is already in progress" when it's called while an autosave is in progress

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
