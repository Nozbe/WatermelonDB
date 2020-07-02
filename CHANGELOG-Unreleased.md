# Changelog

## Unreleased

### BREAKING CHANGES

### New features

- [iOS] Added CocoaPods support - @leninlin
- [Android] `exerimentalUseJSI` option has been enabled on Android. However, it requires some app-specific setup which is not yet documented - stay tuned for upcoming releases
- [Schema] [Migrations] You can now pass `unsafeSql` parameters to schema builder and migration steps to modify SQL generated to set up the database or perform migrations. There's also new `unsafeExecuteSql` migration step. Please use this only if you know what you're doing — you shouldn't need this in 99% of cases. See Schema and Migrations docs for more details

### Changes

### Fixes

### Internal
