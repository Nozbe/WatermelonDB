# Changelog

## Unreleased

### BREAKING CHANGES

- Deprecated `new Database({ actionsEnabled: false })` options is now removed. Actions are always enabled.
- Deprecated `new SQLiteAdapter({ synchronous: true })` option is now removed. Use `{ jsi: true }` instead.
- Deprecated `Q.unsafeLokiFilter` is now removed.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.

### Deprecations

### New features

### Performance

### Changes

### Fixes

### Internal
