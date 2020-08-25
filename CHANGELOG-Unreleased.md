# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Sync] Conflict resolution can now be customized. See docs for more details.

### Changes

- Interal RxJS imports have been refactor such that rxjs-compat should never be used now
- [Performance] Tweak Babel config to produce smaller code
- [Performance] LokiJS-based apps will now take up to 30% less time to load the database (id and unique indicies are generated lazily)

### Fixes

### Internal
