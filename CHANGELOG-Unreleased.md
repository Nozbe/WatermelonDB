# Changelog

## Unreleased

### Highlights

### BREAKING CHANGES

### Deprecations

### New features

### Fixes

- Fix compilation on Kotlin 1.7
- Fix regression in Sync that could cause `Record ID xxx#yyy was sent over the bridge, but it's not cached` error

### Performance

### Changes

- Updated Flow version used in the project to 198.1. This shouldn't have an impact on you, but could fix or break Flow if you don't have WatermelonDB set to `[declarations]` mode
- Clarified docs to recommend the use of `[declarations]` mode for WatermelonDB

### Internal

- Update internal dependencies
- Fix Android CI
