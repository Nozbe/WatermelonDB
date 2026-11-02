### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [Sync] A pulled changeset is now validated in full before any of it is applied (table and record shape, string ids, ids listed more than once in a table's created/updated/deleted). Before, an invalid record found halfway through left already-prepared records broken in memory, and updating them failed until the app restarted. Records with a non-string `id` are now rejected instead of being given a random id
- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
