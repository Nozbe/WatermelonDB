# Installation

First, add Watermelon to your project:

```bash
yarn add @nozbe/watermelondb
yarn add @nozbe/with-observables
```
or alternatively if you prefer npm:

```npm
npm install @nozbe/watermelondb
npm install @nozbe/with-observables
```

## React Native setup

1. Install the Babel plugin for decorators if you haven't already:
    ```bash
    yarn add --dev @babel/plugin-proposal-decorators
    ```
    or
    
    ```bash
    npm install -D @babel/plugin-proposal-decorators
    
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
   - Right-click on **Your App Name** in the Project Navigator on the left, and click **New File…**
   - Create a single empty `Swift` file to the project (make sure that **Your App Name** target is selected when adding), and when Xcode asks, press **Create Bridging Header** and **do not remove `Swift`** file then.
3. **Link WatermelonDB's native library with the Xcode project**:

    **Automatically**

    ```bash
    react-native link @nozbe/watermelondb
    ```

    **Or manually**

    If you don't want to use `react-native link`, you can link the library manually:

    1. Open your project in Xcode, right click on **Libraries** in the Project Navigator on the left and click **Add Files to "Your Project Name"**. Look under `node_modules/@nozbe/watermelondb/native/ios` and select `WatermelonDB.xcodeproj`
    2. Go to Project settings (top item in the Project navigator on the left), select your app name under **Targets** → **Build Phases** → **Link Binary With Libraries**, and add `libWatermelonDB.a`
    
    For more information about linking libraries manually, [see React Native documentation](https://facebook.github.io/react-native/docs/linking-libraries-ios).
    
    **Using CocoaPods**
    
    [Please contribute!](https://github.com/Nozbe/WatermelonDB/issues/279)

Note that Xcode 9.4 and a deployment target of at least iOS 9.0 is required (although Xcode 10 and iOS 11.0 are recommended).

### Android (React Native)

1. **Set up Babel config in your project**
   
   See instructions above ⬆️
   
1. In `android/settings.gradle`, add:

   ```gradle
   include ':watermelondb'
   project(':watermelondb').projectDir =
       new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android')
   ```
2. In `android/app/build.gradle`, add:
   ```gradle
   apply plugin: "com.android.application"
   apply plugin: 'kotlin-android'  // ⬅️ This!
   // ...
   dependencies {
       // ...
       implementation project(':watermelondb')  // ⬅️ This!
   }
   ```
3. In `android/build.gradle`, add Kotlin support to the project:
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
4. And finally, in `android/app/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:
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
5. **Troubleshooting**. If you get this error:
    > `Can't find variable: Symbol`

    You might need a polyfill for ES6 Symbol:

    ```bash
    yarn add es6-symbol
    ```

    And in your `index.js`:

    ```bash
    import 'es6-symbol/implement'
    ```

    Alternatively, we also recommend [`jsc-android`](https://github.com/react-community/jsc-android-buildscripts), with which you don't need this polyfill, and it also makes your app faster.

## Web setup

This guide assumes you use Webpack as your bundler.

1. Install [worker-loader](https://github.com/webpack-contrib/worker-loader) Webpack plugin to add support for Web Workers to your app:
    ```sh
    yarn add --dev worker-loader
    ```
    or
    
    ```bash
    npm install -D worker-loader
    ```
    
2. And add this to Webpack configuration:
    ```js
    // webpack.config.js
    {
      module: {
        rules: [
          // ⬇️ Add this:
          {
            test: /\.worker\.js$/,
            use: { loader: 'worker-loader' }
          }
        ]
      },
      // ...
      output: {
        // ...
        globalObject: 'this', // ⬅️ And this
      }
    }
    ```
3. If you haven't already, install Babel plugins for decorators, static class properties, and async/await to get the most out of Watermelon. This assumes you use Babel 7 and already support ES6 syntax.
    ```bash
    yarn add --dev @babel/plugin-proposal-decorators
    yarn add --dev @babel/plugin-proposal-class-properties
    yarn add --dev @babel/plugin-transform-runtime
    ```
    or
    ```bash
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

## Set up `Database`

Create `model/schema.js` in your project:

```js
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    // tableSchemas go here...
  ]
})
```

You'll need it for [the next step](./Schema.md). Now, in your `index.js`:

```js
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './model/schema'
// import Post from './model/Post' // ⬅️ You'll import your Models here

// First, create the adapter to the underlying database:
const adapter = new SQLiteAdapter({
  schema,
})

// Then, make a Watermelon database from it!
const database = new Database({
  adapter,
  modelClasses: [
    // Post, // ⬅️ You'll add Models to Watermelon here
  ],
  actionsEnabled: true,
})
```

The above will work on iOS and Android (React Native). For the web, instead of `SQLiteAdapter` use `LokiJSAdapter`:

```js
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({
  schema,
})

// The rest is the same!
```

* * *

## Next steps

➡️ After Watermelon is installed, [**define your app's schema**](./Schema.md)
