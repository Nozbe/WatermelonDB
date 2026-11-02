### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

- [Sync] `markLocalChangesAsSynced` and applying pulled changes to locally deleted records now run in linear time (lookups use a Map/Set instead of scanning arrays), which speeds up syncs with many local changes or deletions

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
