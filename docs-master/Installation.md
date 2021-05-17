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
      "plugins": [
        ["@babel/plugin-proposal-decorators", { "legacy": true }]
      ]
    }
    ```
3. Set up your iOS or Android project — see instructions below

### iOS (React Native)

1. **Set up Babel config in your project**

   See instructions above ⬆️

2. **Add Swift support to your Xcode project**:

   - Open `ios/YourAppName.xcodeproj` in Xcode
   - Right-click on **(your app name)** in the Project Navigator on the left, and click **New File…**
   - Create a single empty Swift file (`wmelon.swift`) to the project (make sure that **Your App Name** target is selected when adding), and when Xcode asks, press **Create Bridging Header** and **do not remove** the Swift file afterwards

3. **Link WatermelonDB's native library using CocoaPods**

    Add this to your `Podfile` (if you're using autolinking, it might not be needed):

    ```ruby
    pod 'WatermelonDB', :path => '../node_modules/@nozbe/watermelondb'

    # NOTE: Do not remove, needed to keep WatermelonDB compiling:
    pod 'React-jsi', :path => '../node_modules/react-native/ReactCommon/jsi', :modular_headers => true
    ```

    Note that as of WatermelonDB 0.22, manual (non-CocoaPods) linking is not supported.

    At least Xcode 12.2 and iOS 13 are recommended (earlier versions are not tested for compatibility).

4. **Fix up your Bridging Header**

    You will likely see that the iOS build fails to compile. If this happens, locate the Swift Bridging Header (likely `ios/YourAppName/YourAppName-Bridging-Header.h`), and paste this:

    ```objc
    #import <React/RCTBundleURLProvider.h>
    #import <React/RCTRootView.h>
    #import <React/RCTViewManager.h>
    #import <React/RCTBridgeModule.h>

    // Silence warning
    #import "../../node_modules/@nozbe/watermelondb/native/ios/WatermelonDB/SupportingFiles/Bridging.h"
    ```

    You might have to tweak the import path to correctly locate Watermelon's bridging header.

### Android (React Native)

**Set up Babel config in your project**

See instructions above ⬆️

On RN60+, auto linking should work.

<details>
  <summary>Linking Manually</summary>

  Users on React Native 0.60+ automatically have access to "autolinking", requiring no further manual installation steps. If you are on React Native 0.60+   please skip this section. If you are on React Native < 0.60 please do the following in **addition** to the previous steps:

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
  Just set ext properties `kotlinVersion` in `android/build.gradle`, and WatermelonDB will use the specified kotlin version.

  ```gradle
  buildscript {
      ext.kotlinVersion = '1.3.21'
  }
  ```
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

   1. Make sure you have NDK installed (version `20.1.5948944` has been tested to work when writing this guide)
   1. In `android/settings.gradle`, add:

      ```gradle
      include ':watermelondb-jsi'
      project(':watermelondb-jsi').projectDir =
          new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android-jsi')
      ```
   2. In `android/app/build.gradle`, add:
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
   3. And finally, in `android/app/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:
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
      or if you have **multiple** JSI Packages:
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
                 // ⬅️ add more JSI packages here by conventions above
                 
                 return modules;
               }
             };
           }
         }
      ```
</details>

## NodeJS setup

1. Install [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) peer dependency
    ```sh
    yarn add --dev better-sqlite3

    # (or with npm:)
    npm install -D better-sqlite3
    ```

## Web setup

This guide assumes you use Webpack as your bundler.

3. If you haven't already, install Babel plugins for decorators, static class properties, and async/await to get the most out of Watermelon. This assumes you use Babel 7 and already support ES6 syntax.
    ```bash
    yarn add --dev @babel/plugin-proposal-decorators
    yarn add --dev @babel/plugin-proposal-class-properties
    yarn add --dev @babel/plugin-transform-runtime

    # (or with npm:)
    npm install -D @babel/plugin-proposal-decorators
    npm install -D @babel/plugin-proposal-class-properties
    npm install -D @babel/plugin-transform-runtime
    ```
4. Add ES7 support to your `.babelrc` file:
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

* * *

## Next steps

➡️ After Watermelon is installed, [**set it up**](./Setup.md)
