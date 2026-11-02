### Highlights

### BREAKING CHANGES

### Deprecations

### New features

- New `destroyTable({ table })` migration step. On SQLite, it's `DROP TABLE IF EXISTS`. On LokiJS, the collection is removed and its data is deleted from IndexedDB, so it's no longer loaded and parsed on every launch (also if it was already removed from Loki)
- [LokiJS] New `unsafeExecuteLoki(loki => {})` migration step, the LokiJS counterpart of `unsafeExecuteSql()`. It's ignored on SQLite
- [LokiJS] `unsafeExecuteSql()` migration steps, which are ignored on LokiJS, now log a warning

### Fixes

- [LokiJS] Multitab sync issue fix
- [LokiJS] When a migration fails, changes made by the steps that ran before the failure are no longer autosaved under the old schema version
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
