# Changelog

## Unreleased

### BREAKING CHANGES

- `Q.experimentalSortBy`, `Q.experimentalSkip`, `Q.experimentalTake` have been renamed to `Q.sortBy`, `Q.skip`, `Q.take` respectively
- **RxJS has been updated to 7.3.0**. If you're not importing from `rxjs` in your app, this doesn't apply to you. If you are, read RxJS 7 breaking changes: https://rxjs.dev/deprecations/breaking-changes

### Deprecations

### New features

- `db.write(writer => { ... writer.batch() })` - you can now call batch on the interface passed to a writer block
- **Fetching record IDs and unsafe raws.** You can now optimize fetching of queries that only require IDs, not full cached records:
  - `await query.fetchIds()` will return an array of record ids
  - `await query.unsafeFetchRaw()` will return an array of unsanitized, unsafe raw objects (use alongside `Q.unsafeSqlQuery` to exclude unnecessary or include extra columns)
  - advanced `adapter.queryIds()`, `adapter.unsafeQueryRaw` are also available
- **Raw SQL queries**. New syntax for running unsafe raw SQL queries:
  - `collection.query(Q.unsafeSqlQuery("select * from tasks where foo = ?", ['bar'])).fetch()`
  - You can now also run `.fetchCount()`, `.fetchIds()` on SQL queries
  - You can now safely pass values for SQL placeholders by passing an array
  - You can also observe an unsafe raw SQL query -- with some caveats! refer to documentation for more details
- [SQLiteAdapter] Added support for Full Text Search for SQLite adapter:
  Add `isFTS` boolean flag to schema column descriptor for creating Full Text Search-able columns
  Add `Q.ftsMatch(value)` that compiles to `match 'value'` SQL for performing Full Text Search using SQLite adpater
- **LocalStorage**. `database.localStorage` is now available
- **sortBy, skip, take** are now available in LokiJSAdapter as well
- **Disposable records**. Read-only records that cannot be saved in the database, updated, or deleted and only exist for as long as you keep a reference to them in memory can now be created using `collection.disposableFromDirtyRaw()`. This is useful when you're adding online-only features to an otherwise offline-first app.
- [Sync] `experimentalRejectedIds` parameter now available in push response to allow partial rejection of an otherwise successful sync

### Performance

### Changes

### Fixes

- Fixes an issue when using Headless JS on Android with JSI mode enabled - pass `usesExclusiveLocking: true` to SQLiteAdapter to enable
- Fixes Typescript annotations for Collection and adapters/sqlite

### Internal
