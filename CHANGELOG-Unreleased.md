# Changelog

## Unreleased

### BREAKING CHANGES

### New features
- [Model] `Model.update` method now returns updated record
- [Android] Autolinking is now supported (v0.20 is insufficient)

### Performance

### Changes

- [Sync] Optional `log` passed to sync now has more helpful diagnostic information
- [Sync] Open-sourced a simple SyncLogger you can optionally use. See docs for more info.

### Fixes

- [Typescript] Fixed type on OnFunction to accept `and` in join 
- [Typescript] Fixed type `database#batch(records)`'s argument `records` to accept mixed types

### Internal
