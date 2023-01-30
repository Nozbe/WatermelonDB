# Installation

First, add Watermelon to your project:

```bash
yarn add @nozbe/watermelondb

# (or with npm:)
npm install @nozbe/watermelondb
```

## React Native setup

1. Install the Babel plugin for decorators if you haven't already:

   ```bash
   yarn add --dev @babel/plugin-proposal-decorators

   # (or with npm:)
   npm install -D @babel/plugin-proposal-decorators
   ```

2. Add ES6 decorators support to your `.babelrc` file:
   ```json
   {
     "presets": ["module:metro-react-native-babel-preset"],
     "plugins": [["@babel/plugin-proposal-decorators", { "legacy": true }]]
   }
   ```
3. Set up your iOS or Android project — see instructions below

### iOS (React Native)

At least Xcode 13.x and iOS 14 are recommended (earlier versions are not tested for compatibility).

1. **Set up Babel config in your project**

   See instructions above ⬆️

2. **Add Swift support to your Xcode project**:

   You only need to do this if you don't have Swift already set up in your project.

   - Open `ios/YourAppName.xcodeproj` in Xcode
   - Right-click on **(your app name)** in the Project Navigator on the left, and click **New File…**
   - Create a single empty Swift file (`wmelon.swift`) to the project (make sure that **Your App Name** target is selected when adding), and when Xcode asks, press **Create Bridging Header** and **do not remove** the Swift file afterwards

3. **Link WatermelonDB's native library (using CocoaPods)**

   Open your `Podfile` and add this:

   ```ruby
   # Uncomment this line if you're not using auto-linking
   # pod 'WatermelonDB', path: '../node_modules/@nozbe/watermelondb'

   # WatermelonDB dependency, should not be needed on modern React Native
   # (please file an issue if this causes issues for you)
   # pod 'React-jsi', path: '../node_modules/react-native/ReactCommon/jsi', modular_headers: true

   # WatermelonDB dependency
   pod 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true
   ```

   Make sure you run `pod install` (or `bundle exec pod install`) after updating `Podfile`.

   We highly recommend that you _do not_ use frameworks. If WatermelonDB fails to build in the frameworks mode for you, [use this workaround](https://github.com/Nozbe/WatermelonDB/issues/1285#issuecomment-1381323060) to force building it in static library mode.

   Manual (non-CocoaPods) linking is not supported.

### Android (React Native)

**Set up Babel config in your project**

See instructions above ⬆️

<details>
  <summary>Linking Manually</summary>

By default, React Native uses **autolinking**, and **you don't need the steps below**! Only use this with old versions of React Native or if you opt out of autolinking.

1. In `android/settings.gradle`, add:

```gradle
include ':watermelondb'
project(':watermelondb').projectDir =
    new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android')
```

2. In `android/app/build.gradle`, add:

```gradle
// ...
dependencies {
    // ...
    implementation project(':watermelondb')  // ⬅️ This!
}
```

3. And finally, in `android/app/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:

```java
// ...
import com.nozbe.watermelondb.WatermelonDBPackage; // ⬅️ This!
// ...
@Override
protected List<ReactPackage> getPackages() {
  return Arrays.<ReactPackage>asList(
    new MainReactPackage(),
    new WatermelonDBPackage() // ⬅️ Here!
  );
}
```

</details>

<details>
  <summary>Custom Kotlin Version</summary>
  Make sure the kotlin version is set to 1.3.50 or above. Just set ext properties `kotlinVersion` in `android/build.gradle`, and WatermelonDB will use the specified kotlin version.

```gradle
buildscript {
    ext.kotlinVersion = '1.3.50'
}
```

</details>

<details>
  <summary>Using with react-native-screens or react-native-gesture-handler</summary>
  If you are using recent versions of react-native-screens or react-native-gesture-handler,
  you will need to set the kotlin version to 1.5.20 or above (see section above)
</details>

<details>
  <summary>Troubleshooting</summary>
  If you get this error:

> `Can't find variable: Symbol`

You're using an ancient version of JSC. Install [`jsc-android`](https://github.com/react-community/jsc-android-buildscripts) or Hermes.

</details>

<details>
  <summary>JSI Installation (Optional)</summary>

To enable fast, highly performant, synchronous JSI operation on Android, you need to take a few
additional steps manually.

1.  Make sure you have NDK installed (version `20.1.5948944` has been tested to work when writing this guide)
2.  In `android/settings.gradle`, add:

    ```gradle
    include ':watermelondb-jsi'
    project(':watermelondb-jsi').projectDir =
        new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android-jsi')
    ```

3.  In `android/app/build.gradle`, add:

    ```gradle
    // ...
    android {
      // ...
      packagingOptions {
         pickFirst '**/libc++_shared.so' // ⬅️ This (if missing)
      }
    }

    dependencies {
        // ...
        implementation project(':watermelondb-jsi') // ⬅️ This!
    }
    ```

4.  If you're using Proguard, in `android/app/proguard-rules.pro` add:
    ```
    -keep class com.nozbe.watermelondb.** { *; }
    ```
5.  And finally, in `android/app/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:

    ```java
    // ...
    import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage; // ⬅️ This!
    import com.facebook.react.bridge.JSIModulePackage; // ⬅️ This!
    // ...
    private final ReactNativeHost mReactNativeHost =
       new ReactNativeHost(this) {
         // ...

         @Override
         protected JSIModulePackage getJSIModulePackage() {
           return new WatermelonDBJSIPackage(); // ⬅️ This!
         }
       }

    ```

    or if you have **multiple** JSI Packages (for example, when using `reanimated`):

    ```java
    // ...
    import java.util.Arrays; // ⬅️ This!
    import com.facebook.react.bridge.JSIModuleSpec; // ⬅️ This!
    import com.facebook.react.bridge.JSIModulePackage; // ⬅️ This!
    import com.facebook.react.bridge.ReactApplicationContext; // ⬅️ This!
    import com.facebook.react.bridge.JavaScriptContextHolder; // ⬅️ This!
    import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage; // ⬅️ This!
    // ...
    private final ReactNativeHost mReactNativeHost =
       new ReactNativeHost(this) {
         // ...

         @Override
         protected JSIModulePackage getJSIModulePackage() {
           return new JSIModulePackage() {
             @Override
             public List<JSIModuleSpec> getJSIModules(
               final ReactApplicationContext reactApplicationContext,
               final JavaScriptContextHolder jsContext
             ) {
               List<JSIModuleSpec> modules = Arrays.asList();

               modules.addAll(new WatermelonDBJSIPackage().getJSIModules(reactApplicationContext, jsContext)); // ⬅️ This!
               // ⬅️ add more JSI packages here by conventions above, for example:
               // modules.addAll(new ReanimatedJSIModulePackage().getJSIModules(reactApplicationContext, jsContext));

               return modules;
             }
           };
         }
       }
    ```

#### Troubleshooting JSI issues

If you see a crash at launch similar to this after updating React Native:

```
signal 11 (SIGSEGV), code 2 (SEGV_ACCERR), fault addr 0x79193ac4a9
(...)
backtrace:
      (...)
      watermelondb::createMethod(facebook::jsi::Runtime&, facebook::jsi::Object&, char const*, unsigned int, std::__ndk1::function<facebook::jsi::Value (facebook::jsi::Runtime&, facebook::jsi::Value const*)>)+88
      watermelondb::Database::install(facebook::jsi::Runtime*)+96)
      (...)
```

… this is most likely due to broken `libc++_shared`. Run `./gradlew clean` from `native/android`, then try again.

</details>

## Web setup

This guide assumes you use Webpack as your bundler.

1. If you haven't already, install Babel plugins for decorators, static class properties, and async/await to get the most out of Watermelon. This assumes you use Babel 7 and already support ES6 syntax.

   ```bash
   yarn add --dev @babel/plugin-proposal-decorators
   yarn add --dev @babel/plugin-proposal-class-properties
   yarn add --dev @babel/plugin-transform-runtime

   # (or with npm:)
   npm install -D @babel/plugin-proposal-decorators
   npm install -D @babel/plugin-proposal-class-properties
   npm install -D @babel/plugin-transform-runtime
   ```

2. Add ES7 support to your `.babelrc` file:
   ```json
   {
     "plugins": [
       ["@babel/plugin-proposal-decorators", { "legacy": true }],
       ["@babel/plugin-proposal-class-properties", { "loose": true }],
       [
         "@babel/plugin-transform-runtime",
         {
           "helpers": true,
           "regenerator": true
         }
       ]
     ]
   }
   ```

## NodeJS (SQLite) setup

You only need this if you want to use WatermelonDB in NodeJS with SQLite (e.g. for scripts that share code with your web/React Native app)

1. Install [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) peer dependency

   ```sh
   yarn add --dev better-sqlite3

   # (or with npm:)
   npm install -D better-sqlite3
   ```

---

## Next steps

➡️ After Watermelon is installed, [**set it up**](./Setup.md)
