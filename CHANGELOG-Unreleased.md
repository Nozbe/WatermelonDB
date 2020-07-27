# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [iOS] Added CocoaPods support - @leninlin
- [Android] `exerimentalUseJSI` option has been enabled on Android. However, it requires some app-specific setup which is not yet documented - stay tuned for upcoming releases
- [Schema] [Migrations] You can now pass `unsafeSql` parameters to schema builder and migration steps to modify SQL generated to set up the database or perform migrations. There's also new `unsafeExecuteSql` migration step. Please use this only if you know what you're doing — you shouldn't need this in 99% of cases. See Schema and Migrations docs for more details

### Changes

- [Performance] findAndObserve is now able to emit a value synchronously. By extension, this makes Relations put into withObservables able to render the child component in one shot. Avoiding the extra unnecessary render cycles avoids a lot of DOM and React commit-phase work, which can speed up loading some views by 30%
- [Performance] LokiJS is now faster (refactored encodeQuery, skipped unnecessary clone operations)

### Fixes

### Internal
