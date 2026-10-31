### Highlights

### BREAKING CHANGES

### Deprecations

### New features

- New `Collection.observeRecord(id)`: a failsafe version of `findAndObserve(id)` that emits `null` while the record does not exist (instead of erroring), emits the record once it is created, and emits `null` (instead of completing) when it is deleted. `@experimentalFailsafe` relations now use it, so their `observe()` recovers when a missing related record is created later

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
