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

1. **Set up Babel config in your project**

   See instructions above ⬆️

2. In `android/settings.gradle`, add:

   ```gradle
   include ':watermelondb'
   project(':watermelondb').projectDir =
       new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android')
   ```
3. In `android/app/build.gradle`, add:
   ```gradle
   apply plugin: "com.android.application"
   apply plugin: 'kotlin-android'  // ⬅️ This!
   // ...
   dependencies {
       // ...
       implementation project(':watermelondb')  // ⬅️ This!
   }
   ```
4. In `android/build.gradle`, add Kotlin support to the project:
   ```gradle
   buildscript {
       ext.kotlin_version = '1.3.21'
       // ...
       dependencies {
           // ...
           classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
       }
   }
   ```
5. And finally, in `android/app/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:
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
6. **Troubleshooting**. If you get this error:
    > `Can't find variable: Symbol`

    You're using an ancient version of JSC. Install [`jsc-android`](https://github.com/react-community/jsc-android-buildscripts) or Hermes.


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
