# Changelog

## Unreleased

### BREAKING CHANGES

- `Q.experimentalSortBy`, `Q.experimentalSkip`, `Q.experimentalTake` have been renamed to `Q.sortBy`, `Q.skip`, `Q.take` respectively

### Deprecations

### New features

- **sortBy, skip, take** are now available in LokiJSAdapter as well

### Performance

### Changes

### Fixes

- Fixes an issue when using Headless JS on Android with JSI mode enabled - pass `usesExclusiveLocking: true` to SQLiteAdapter to enable

### Internal
