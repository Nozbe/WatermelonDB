### Highlights

### BREAKING CHANGES

- [iOS] Podspec deployment target was bumped from iOS 11 to iOS 12

### Deprecations

### New features

- Added `Database#experimentalIsVerbose` option
- New migration steps available:
  - `destroyColumn` (see docs for limitations)
  - `renameColumn` (see docs for limitations)
  - `destroyTable`

### Fixes

- [ts] Improved LocalStorage type definition
- [ts] Add missing .d.ts for experimentalFailsafe decorator
- [migrations] `unsafeExecuteSql` migration is now validate to ensure it ends with a semicolon (#1811)

### Performance

### Changes

- Improved Model diagnostic errors now always contain `table#id` of offending record
- Update `better-sqlite3` to 11.x
- Update sqlite (used by Android in JSI mode) to 3.46.0
- [docs] Improved Android installation docs

### Internal

- Update internal dependencies
