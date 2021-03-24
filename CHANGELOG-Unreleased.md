# Changelog

## Unreleased

### BREAKING CHANGES

### Deprecations

- [LokiJS] `Q.unsafeLokiFilter` is now deprecated and will be removed in a future version.
    Use `Q.unsafeLokiTransform((raws, loki) => raws.filter(raw => ...))` instead.

### New features

### Performance

- Removed dependency on rambdax and made the util library smaller to keep

### Changes

- [Docs] Add advanced tutorial to share database across iOS targets
- [Sqlite] Allowed callbacks (within the migrationEvents object) to be passed so as to track the migration events status ( onStart, onSuccess, onError )

### Fixes

### Internal
