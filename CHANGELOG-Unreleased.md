### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript
- [SQLite] [JSI] Database setup failures on the JSI path (database file cannot be opened, schema setup or migration fails) now reject the setup promise and reach `onSetUpError` instead of crashing the app
- [SQLite] [JSI] A failed `unsafeResetDatabase()` now rejects instead of crashing the app, and leaves the (empty, consistent) database open so the reset can be retried. Other calls on a database whose setup or reset failed are rejected instead of failing an assertion
- `database.unsafeResetDatabase()` that fails now restores the adapter (and clears record caches, since data may already be erased), so the reset can be retried instead of every later call failing with "Cannot call database.adapter.X while the database is being reset"
- Adapters now clear their cached record IDs at the start of `unsafeResetDatabase()`, so a reset that fails early no longer leaves later fetches failing with "Record ID ... was sent over the bridge, but it's not cached"
- [SQLite] [JSI] Calling a native method with the wrong number of arguments now throws a JS error on Android too, instead of crashing the app
- [SQLite] [JSI] Empty or comment-only raw SQL queries, and record queries (`Q.unsafeSqlQuery`) whose first column is not `id`, now reject instead of failing a native assertion
- [SQLite] [JSI] The prepared statement cache is now bounded (256 statements, least recently used are finalized first), so one-off queries no longer keep a prepared statement alive for the lifetime of the database

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
