# Changelog

## Unreleased

### BREAKING CHANGES

- Deprecated `new Database({ actionsEnabled: false })` options is now removed. Actions are always enabled.
- Deprecated `new SQLiteAdapter({ synchronous: true })` option is now removed. Use `{ jsi: true }` instead.
- Deprecated `Q.unsafeLokiFilter` is now removed.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.
- Deprecated `Query.hasJoins` is now removed

### Deprecations

- `database.action(() => {})` is now deprecated. Use `db.write(() => {})` instead (or `db.read(() => {})` if you only need consistency but are not writing any changes to DB)
- `@action` is now deprecated. Use `@writer` or `@reader` instead
- `.subAction()` is now deprecated. Use `.callReader()` or `.callWriter()` instead

### New features

- `db.write(writer => { ... writer.batch() })` - you can now call batch on the interface passed to a writer block

### Performance

### Changes

- All Watermelon console logs are prepended with a 🍉 tag
- Extra protections against improper use of writers/readers (formerly actions) have been added

### Fixes

### Internal
