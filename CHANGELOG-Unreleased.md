### Highlights

### BREAKING CHANGES

- [iOS] Podspec deployment target was bumped from iOS 11 to iOS 12

### Deprecations

### New features

- Added `Database#experimentalIsVerbose` option
- Added destroyColumn migration step
- Added renameColumn migration step
- Added destroyTable migration step

### Fixes

- [ts] Improved LocalStorage type definition
- [ts] Add missing .d.ts for experimentalFailsafe decorator

### Performance

### Changes

- Improved Model diagnostic errors now always contain `table#id` of offending record
- Update `better-sqlite3` to 9.x
- [docs] Improved Android installation docs

### Internal

- Update internal dependencies
