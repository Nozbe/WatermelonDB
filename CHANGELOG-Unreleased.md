# Changelog

## Unreleased
- [Android] Provides the user with the ability to pass in a file path instead of the database name only and creates the *.db file under a 'databases' sub-folder under the provided path.  Pattern for file path is *file:///data/user/0/com.mattermost.rnbeta/files/xxx.db*
### BREAKING CHANGES

- `Q.experimentalSortBy`, `Q.experimentalSkip`, `Q.experimentalTake` have been renamed to `Q.sortBy`, `Q.skip`, `Q.take` respectively
- **RxJS has been updated to 7.3.0**. If you're not importing from `rxjs` in your app, this doesn't apply to you. If you are, read RxJS 7 breaking changes: https://rxjs.dev/deprecations/breaking-changes

### Deprecations

### New features

- **sortBy, skip, take** are now available in LokiJSAdapter as well

### Performance

### Changes

### Fixes

- Fixes an issue when using Headless JS on Android with JSI mode enabled - pass `usesExclusiveLocking: true` to SQLiteAdapter to enable

### Internal
