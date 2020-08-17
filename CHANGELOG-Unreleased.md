# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [iOS] Added CocoaPods support - @leninlin
- [NodeJS] Introducing a new SQLite Adapter based integration to NodeJS. This requires a
peer dependency on [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3)
and should work with the same configuration as iOS/Android - @sidferreira
- [Android] `exerimentalUseJSI` option has been enabled on Android. However, it requires some app-specific setup which is not yet documented - stay tuned for upcoming releases
- [Schema] [Migrations] You can now pass `unsafeSql` parameters to schema builder and migration steps to modify SQL generated to set up the database or perform migrations. There's also new `unsafeExecuteSql` migration step. Please use this only if you know what you're doing — you shouldn't need this in 99% of cases. See Schema and Migrations docs for more details
- [LokiJS] [Performance] Added experimental `onIndexedDBFetchStart` and `indexedDBSerializer` options to `LokiJSAdapter`. These can be used to improve app launch time. See `src/adapters/lokijs/index.js` for more details.

### Changes

- [Performance] findAndObserve is now able to emit a value synchronously. By extension, this makes Relations put into withObservables able to render the child component in one shot. Avoiding the extra unnecessary render cycles avoids a lot of DOM and React commit-phase work, which can speed up loading some views by 30%
- [Performance] LokiJS is now faster (refactored encodeQuery, skipped unnecessary clone operations)
- [Performance] LokiJS-based apps will now take up to 30% less time to load the database (id and unique indicies are generated lazily)

### Fixes

### Internal
