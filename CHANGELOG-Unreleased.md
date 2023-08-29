TODO: After shipping, make minor bump to @nozbe/withObservables and add deprecation notice

### Highlights

**Removed legacy Swift and Kotlin React Native Modules**

Following the addition of new Native Modules in 0.26, we're removing the old implementations. We expect this to simplify installation process and remove a ton of compatibility and configuration issues due to Kotlin version mismatchs and the CocoaPods-Swift issues when using `use_frameworks!` or Expo.

**Experimental React Native Windows support**

WatermelonDB now has _experimental_ support for React Native Windows. See Installation docs for details.

**Introducing Watermelon React**

All React/React Native helpers for Watermelon are now available from a new `@nozbe/watermelodb/react` folder:

- `DatabaseProvider`, `useDatabase`, `withDatabase`
- NEW: `withObservables` - `@nozbe/with-observables` as a separate package is deprecated, and is now bundled with WatermelonDB
- NEW: HOC helpers: `compose`, `withHooks`
- NEW: `<WithObservables />` component, a component version of `withObservables` HOC. Useful when a value being observed is localized to a small part of a larger component, because you can effortlessly narrow down which parts of the component are re-rendered when the value changes without having to extract a new component.

Imports from previous `@nozbe/watermelondb/DatabaseProvider` and `@nozbe/watermelondb/hooks` folders are deprecated and will be removed in a future version.

**Introducing Watermelon Diagnostics**

All debug/dev/diagnostics tools for Watermelon are now available from a new `@nozbe/watermelondb/diagnostics` folder:

- NEW: `censorRaw` - takes a `RawRecord/DirtyRaw` and censors its string values, while preserving IDs, _status, _changed, and numeric/boolean values. Helpful when viewing database contents in context that could expose private user information
- NEW: `diagnoseDatabaseStructure` - analyzes database to find inconsistencies, such as orphaned records (`belongs_to` relations on model that point to records that don't exist) or broken LokiJS database. Use this to find bugs in your data model.
- NEW: `diagnoseSyncConsistency` - compares local database with the server version (contents of first/full sync) to find inconsistencies, missing and excess records. Use this to find bugs in your backend sync implementation.

### BREAKING CHANGES

- `@nozbe/with-observables` is no longer a WatermelonDB dependency. Change your imports to `import { withObservables } from '@nozbe/watermelondb/react'`

Changes unlikely to cause issues:

- [iOS] If `import WatermelonDB` is used in your Swift app (for Turbo sync), remove it and replace with `#import <WatermelonDB/WatermelonDB.h>` in the bridging header
- [iOS] If you use `_watermelonDBLoggingHook`, remove it. No replacement is provided at this time, feel free to contribute if you need this
- [iOS] If you use `-DENABLE_JSLOCK_PERFORMANCE_HACK`, remove it. JSLockPerfHack has been non-functional for some time already, and has now been removed. Please file an issue if you relied on it.

### Deprecations

- Imports from `@nozbe/watermelondb/DatabaseProvider` and `@nozbe/watermelondb/hooks`. Change to `@nozbe/watermelondb/react`

### New features

- New `@experimentalFailsafe` decorator you can apply before `@relation/@immutableRelation` so that if relation points to a record that does not exist, `.fetch()/.observe()` yield `undefined` instead of throwing an error

### Fixes

- [Flow/TS] Improved typing of DatabaseContext
- Fixed `Cannot read property 'getRandomIds' of null`. This error occured if native modules were not correctly installed, however the location of the error caused a lot of confusion.

### Performance

### Changes

### Internal
