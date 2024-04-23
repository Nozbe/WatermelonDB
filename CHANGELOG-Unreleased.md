### Highlights

### BREAKING CHANGES

#### 2024-01-17

- SyncPushArgs was renamed to SyncPushChangesArgs to free SyncPushArgs which is now used for push sync.
- lastPulletAt in pushChanges is no longer forced to be defined

### Deprecations

### New features

- Added `Database#experimentalIsVerbose` option

### Fixes

- [ts] Improved LocalStorage type definition
- [ts] Add missing .d.ts for experimentalFailsafe decorator

### Performance

### Changes

- Improved Model diagnostic errors now always contain `table#id` of offending record
- Update `better-sqlite3` to 9.x
- [docs] Improved Android installation docs

### Internal
