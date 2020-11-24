# Changelog

## Unreleased

### BREAKING CHANGES
- [LokiJS] `useWebWorker` and `useIncrementalIndexedDB` options are now required (previously, skipping them would only trigger a warning)

### New features
- [Model] `Model.update` method now returns updated record

### Performance

### Changes

- [Sync] Optional `log` passed to sync now has more helpful diagnostic information
- [Sync] Open-sourced a simple SyncLogger you can optionally use. See docs for more info.

### Fixes

- [Typescript] Fixed type on OnFunction to accept `and` in join

### Internal

- Added an experimental mode where a broken database state is detected, further mutations prevented, and the user notified
