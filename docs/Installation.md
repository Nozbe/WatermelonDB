# Installation

First, add Watermelon to your project:

```bash
yarn add @nozbe/watermelondb
```

## React Native setup

1. Install the Babel plugin for decorators if you haven't already:
    ```bash
    yarn add --dev @babel/plugin-proposal-decorators
    ```
2. Add Watermelon Babel plugin and ES6 decorators support to your `.babelrc` file:
    ```json
    {
      "presets": ["react-native"],
      "plugins": [
        "@nozbe/watermelondb/babel/cjs",
        ["@babel/plugin-proposal-decorators", { "legacy": true }]
      ]
    }
    ```
3. Set up your iOS or Android project — see instructions below

### iOS (React Native)

1.  Link with the Xcode project automatically:
    ```bash
    react-native link
    ```
2. If you get linker errors when building, you need to add Swift support to the project:
   - Open `ios/YourAppName.xcodeproj` in Xcode
   - Right-click on **Your App Name** in the Project Navigator on the left, and click **New File…**
   - Create a single empty Swift file to the project (make sure that **Your App Name** target is selected when adding), and when Xcode asks, press **Create Bridging Header**.

Note that Xcode 9.4 and a deployment target of at least iOS 9.0 is required (although iOS 11.0 is recommended).

#### Manual linking

If you don't want to use `react-native link`, you can manually link WatermelonDB's native library with your Xcode project. All other steps are the same.

1. Open your project in Xcode, right click on **Libraries** in the Project Navigator on the left and click **Add Files to "Your Project Name"**. Look under `node_modules/@nozbe/watermelondb/native/ios` and select `WatermelonDB.xcodeproj`
2. Go to Project settings (top item in the Project navigator on the left), select your app name under **Targets** → **Build Phases** → **Link Binary With Libraries**, and add `libWatermelonDB.a`

For more information about linking libraries manually, [see React Native documentation](https://facebook.github.io/react-native/docs/linking-libraries-ios).

### Android (React Native)

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
       compile project(':watermelondb')  // ⬅️ This!
   }
   ```
3. In `android/build.gradle`, add Kotlin support to the project:
   ```gradle
   buildscript {
       ext.kotlin_version = '1.2.61'
       // ...
       dependencies {
           // ...
           classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
       }
   }
   ```
4. And finally, in `android/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:
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

## Web setup

This guide assumes you use Webpack as your bundler.

1. Install [worker-loader](https://github.com/webpack-contrib/worker-loader) Webpack plugin to add support for Web Workers to your app:
    ```sh
    yarn add --dev worker-loader
    ```
2. … and add this to Webpack configuration:
    ```js
    // webpack.config.js
    {
      module: {
        rules: [
          {
            test: /\.worker\.js$/,
            use: { loader: 'worker-loader' }
          }
        ]
      }
    }
    ```
3. Install the Babel plugin for decorators if you haven't already:
    ```bash
    yarn add --dev @babel/plugin-proposal-decorators
    ```
4. Add Watermelon Babel plugin and ES6 decorators support to your `.babelrc` file:
    ```json
    {
      "plugins": [
        "@nozbe/watermelondb/babel/esm",
        ["@babel/plugin-proposal-decorators", { "legacy": true }]
      ]
    }
    ```

## Set up `Database`

Create `model/schema.js` in your project:

```js
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
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

import { mySchema } from 'model/schema'
// import Post from 'model/Post' // ⬅️ You'll import your Models here

// First, create the adapter to the underlying database:
const adapter = new SQLiteAdapter({
  dbName: 'myAwesomeApp', // ⬅️ Give your database a name!
  schema: mySchema,
})

// Then, make a Watermelon database from it!
const database = new Database({
  adapter,
  modelClasses: [
    // Post, // ⬅️ You'll add Models to Watermelon here
  ],
})
```

The above will work on iOS and Android (React Native). For the web, instead of `SQLiteAdapter` use `LokiJSAdapter`:

```js
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({
  dbName: 'myAwesomeApp',
  schema: mySchema,
})

// The rest is the same!
```

* * *

## Next steps

➡️ After Watermelon is installed, [**define your app's schema**](./Schema.md)
