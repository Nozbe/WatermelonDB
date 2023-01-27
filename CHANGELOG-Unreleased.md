# Changelog

## Unreleased

### Highlights

- [iOS] Older version of iOS Installation docs said to import WatermelonDB's `SupportingFiles/Bridging.h` from your app project's `Bridging.h`.
  This is no longer recommended, and you should remove this import from your project. If this removal causes build issues, please file an issue.
- [iOS] Watermelon should now work when using CocoaPods in the `use_frameworks!` mode without workarounds (note that we highly recommend _not_ using frameworks, however this is relevant to users of some React Native modules that require it)

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- Fix compilation on Kotlin 1.7
- Fix regression in Sync that could cause `Record ID xxx#yyy was sent over the bridge, but it's not cached` error
- Fix "range of supported deployment targets" Xcode warning
- [JSI] Improved reliability when reloading RCTBridge

### Performance

### Changes

- Simplified CocoaPods/iOS integration
- Updated `@babel/runtime` to 7.20.13
- Updated `rxjs` to 7.8.0
- Updated `sqlite` (SQLite used on Android in JSI mode) to 3.40.1
- Updated `simdjson` to 3.1.0
- Updated Installation docs
- [flow] Updated Flow version used in the project to 198.1. This shouldn't have an impact on you, but could fix or break Flow if you don't have WatermelonDB set to `[declarations]` mode
- [flow] Clarified docs to recommend the use of `[declarations]` mode for WatermelonDB

### Internal

- Update internal dependencies
- Fix Android CI
