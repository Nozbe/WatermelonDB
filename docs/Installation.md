# Installation

Add Watermelon to your project:

```bash
yarn add @nozbe/watermelondb
```

### iOS (React Native)

Link with the Xcode project automatically:

```bash
react-native link
```

If you get linker errors when building, open `ios/YourAppName.xcodeproj` in Xcode, right-click on **Your App Name** in the Project Navigator on the left, and click **New File…**. Create a single empty Swift file to the project (make sure that **Your App Name** target is selected when adding), and when Xcode asks, press **Create Bridging Header**.

#### Manual linking

1. Open your project in Xcode, right click on **Libraries** in the Project Navigator on the left and click **Add Files to "Your Project Name"**. Look under `node_modules/@nozbe/watermelondb/native/ios` and select `WatermelonDB.xcodeproj`
2. Go to Project settings (top item in the Project navigator on the left), select your app name under **Targets** → **Build Phases** → **Link Binary With Libraries**, and add `libWatermelonDB.a`

For more information about linking libraries manually, [see React Native documentation](https://facebook.github.io/react-native/docs/linking-libraries-ios).

Note that Xcode 9.3 and a deployment target of at least iOS 9.0 is required (although iOS 11.0 is recommended).

### Android (React Native)

1. In `android/settings.gradle`, add:
```gradle
include ':watermelondb'
project(':watermelondb').projectDir =
    new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android')
```

2. In `android/app/build.gradle`, add:
```gradle
dependencies {
    // ...
    compile project(':watermelondb')
}
```

3. And finally, in `android/src/main/java/{YOUR_APP_PACKAGE}/MainApplication.java`, add:
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

### Web

WatermelonDB requires Web Workers support. If you use Webpack, just add [worker-loader](https://github.com/webpack-contrib/worker-loader) to your project:

```sh
yarn add --dev worker-loader
```

And in your Webpack config, add this:

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

You also need Babel support for [decorators](https://github.com/loganfsmyth/babel-plugin-transform-decorators-legacy) and `async/await` to take full advantage of WatermelonDB

## Set up `Database`

Create `model/schema.js` in your project:

```js
import { appSchema, tableSchema } from 'watermelondb'

export const mySchema = appSchema({
  version: 1,
  tables: [
    // tableSchemas go here...
  ]
})
```

You'll need it for [the next step](./Schema.md). Now, in your `index.js`:

```js
import { Database } from 'watermelondb'
import SQLiteAdapter from 'watermelondb/adapters/sqlite'

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
import LokiJSAdapter from 'watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({
  dbName: 'myAwesomeApp',
  schema: mySchema,
})

// The rest is the same!
```

* * *

## Next steps

➡️ After Watermelon is installed, [**define your app's schema**](./Schema.md)
