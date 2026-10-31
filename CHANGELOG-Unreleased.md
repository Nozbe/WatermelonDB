### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript
- [SQLite] [iOS] Database setup failures on the legacy (non-JSI) bridge (database cannot be opened, schema setup or migration fails) now reject the promise and reach `onSetUpError` instead of raising an `NSException` that crashes the app
- [SQLite] [iOS] [Android] After a failed schema setup or migration on the legacy (non-JSI) bridge, operations queued during setup are rejected with the setup error and the driver stays connected, so the app can recover with `database.unsafeResetDatabase()` instead of every call hanging (iOS) or being rejected with "No driver with tag N available" (Android). The Node.js SQLite bridge (`sqlite-node`) behaves the same way

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
