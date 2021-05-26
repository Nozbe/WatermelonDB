# Changelog

## Unreleased

### BREAKING CHANGES

- Deprecated `new Database({ actionsEnabled: false })` options is now removed. Actions are always enabled.
- Deprecated `new SQLiteAdapter({ synchronous: true })` option is now removed. Use `{ jsi: true }` instead.
- Deprecated `Q.unsafeLokiFilter` is now removed. Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.
- Deprecated `Query.hasJoins` is now removed
- Changes to `LokiJSAdapter` constructor options:
  - `indexedDBSerializer` -> `extraIncrementalIDBOptions: { serializeChunk, deserializeChunk }`
  - `onIndexedDBFetchStart` -> `extraIncrementalIDBOptions: { onFetchStart }`
  - `onIndexedDBVersionChange` -> `extraIncrementalIDBOptions: { onversionchange }`
  - `autosave: false` -> `extraLokiOptions: { autosave: false }`
- Changes to Internal APIs. These were never meant to be public, and so are unlikely to affect you:
  - `Model._isCommited`, `._hasPendingUpdate`, `._hasPendingDelete` have been removed and changed to `Model._pendingState`
  - `Collection.unsafeClearCache()` is no longer exposed

### Deprecations

- `database.action(() => {})` is now deprecated. Use `db.write(() => {})` instead (or `db.read(() => {})` if you only need consistency but are not writing any changes to DB)
- `@action` is now deprecated. Use `@writer` or `@reader` instead
- `.subAction()` is now deprecated. Use `.callReader()` or `.callWriter()` instead
- `Collection.unsafeFetchRecordsWithSQL()` is now deprecated. Use `collection.query(Q.unsafeSqlQuery("select * from...")).fetch()` instead.

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

### Performance

- The order of Q. clauses in a query is now preserved - previously, the clauses could get rearranged and produce a suboptimal query
- [SQLite] `adapter.batch()` with large numbers of created/updated/deleted records is now between 16-48% faster

### Changes

- All Watermelon console logs are prepended with a 🍉 tag
- Extra protections against improper use of writers/readers (formerly actions) have been added
- Queries with multiple top-level `Q.on('table', ...)` now produce a warning. Use `Q.on('table', [condition1, condition2, ...])` syntax instead.

### Fixes

### Internal

- Internal changes to SQLiteAdapter:
  - .batch is no longer available on iOS implementation
  - .batch/.batchJSON internal format has changed
  - .getDeletedRecords, destroyDeletedRecords, setLocal, removeLocal is no longer available
- encoded SQLiteAdapter schema has changed
