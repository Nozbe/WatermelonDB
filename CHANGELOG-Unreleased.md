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

### Fixes

### Internal
