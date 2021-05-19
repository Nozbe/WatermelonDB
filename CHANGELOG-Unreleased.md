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
- (Internal API, unlikely to affect users) - `Model._isCommited`, `._hasPendingUpdate`, `._hasPendingDelete` have been removed and changed to `Model._pendingState`
- Internal `CollectionMap` is no longer exported from `@nozbe/watermelondb`

### Deprecations

- `database.action(() => {})` is now deprecated. Use `db.write(() => {})` instead (or `db.read(() => {})` if you only need consistency but are not writing any changes to DB)
- `@action` is now deprecated. Use `@writer` or `@reader` instead
- `.subAction()` is now deprecated. Use `.callReader()` or `.callWriter()` instead
- `Collection.unsafeFetchRecordsWithSQL()` is now deprecated. Use `collection.query(Q.unsafeSqlQuery("select * from...")).fetch()` instead.

### New features

- `db.write(writer => { ... writer.batch() })` - you can now call batch on the interface passed to a writer block
- New syntax for running unsafe raw SQL queries: `collection.query(Q.unsafeSqlQuery("select * from tasks where foo = ?", ['bar'])).fetch()`
  - You can now also run `.fetchCount()` on SQL queries
  - You can now safely pass values for SQL placeholders by passing an array
  - You can also observe an unsafe raw SQL query -- with some caveats! refer to documentation for more details

### Performance

### Changes

- All Watermelon console logs are prepended with a 🍉 tag
- Extra protections against improper use of writers/readers (formerly actions) have been added

### Fixes

### Internal
