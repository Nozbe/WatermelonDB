### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- [LokiJS] Multitab sync issue fix
- [Android] Added linker flag for building with 16kB page alignment
- [TS] make catchError visible to typescript
- [iOS] Fixed compilation on React Native 0.88, which removed `RCTCxxBridge`; JSI is installed through the bridge or the bridgeless proxy alike
- [Android] Generate `BuildConfig` explicitly (AGP 9 no longer does for libraries) and stop applying the unused Kotlin plugin, which collides with AGP 9's built-in Kotlin support

### Performance

### Changes

- Updated better-sqlite3 to 11.9.1

### Internal

- Updated internal dependencies
- Updated documentation scripts
