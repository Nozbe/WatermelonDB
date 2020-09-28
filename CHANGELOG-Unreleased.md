# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Sync] Conflict resolution can now be customized. See docs for more details.
ｰ [Android] Autolinking is now supported
- [LokiJS] Adapter autosave option is now configurable

### Changes

- Interal RxJS imports have been refactor such that rxjs-compat should never be used now
- [Performance] Tweak Babel config to produce smaller code
- [Performance] LokiJS-based apps will now take up to 30% less time to load the database (id and unique indicies are generated lazily)

### Fixes

- [iOS] Fixed crash on database reset in apps linked against iOS 14 SDK
- [LokiJS] Fix `Q.like` being broken for multi-line strings on web
- Fixed warn "import cycle" from DialogProvider (#786) by @gmonte.
- Fixed cache date as instance of Date (#828) by @djorkaeffalexandre.

### Internal
