# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [Sync] Conflict resolution can now be customized. See docs for more details.

### Changes

- Interal RxJS imports have been refactor such that rxjs-compat should never be used now
- [Performance] Tweak Babel config to produce smaller code
- [Performance] LokiJS-based apps will now take up to 30% less time to load the database (id and unique indicies are generated lazily)
ｰ [Android] Support Autolinking. Above RN 0.60.x, [Android Installation steps](https://nozbe.github.io/WatermelonDB/Installation.html#android-react-native) is no longer needed expect Babel, Kotlin, and Troubleshooting steps.
- [LokiJS] Adapter autosave option is now configurable

### Fixes
- Fixed warn "import cycle" from DialogProvider (#786) by @gmonte.

### Internal
