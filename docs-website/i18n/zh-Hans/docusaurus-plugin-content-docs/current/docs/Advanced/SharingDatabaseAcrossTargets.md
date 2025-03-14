# iOS - Sharing database across targets

In case you have multiple Xcode targets and want to share your WatermelonDB instance across them, there are 2 options to be followed: via JS or via native Swift / Objective-C.

### When to use this

When you want to access the same database data in 2 or more Xcode targets (Notification Service Extension, Share Extension, iMessage stickers, etc).

### How to do this

**Step 1:** Setting up an App Group

Through Xcode, repeat this process for your **main target** and **every other target** that you want to share the database with:
- Click on target name
- Click **Signing and Capabilities**
- Click **+ Capability**
- Select **App Groups**
- Provide your App Group name, usually `group.$(PRODUCT_BUNDLE_IDENTIFIER)` (e.g.: `group.com.example.MyAwesomeApp`)

> Note: the App Group name must be the **exact same** for every target

This tells iOS to share storage directories between your targets, and in this case, also the Watermelon database.

**Step 2**: Setting up `dbName`:

**Option A**: Via JS

> Note: although this method is simpler, it has the disadvantage of breaking Chrome remote debugging

1. Install [rn-fetch-blob](https://github.com/joltup/rn-fetch-blob#installation)

2. In your JS, when creating the database, get the App Group path using `rn-fetch-blob`:

    ```ts
    import { NativeModules, Platform } from 'react-native';
    import { Database } from '@nozbe/watermelondb';
    import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
    import schema from './schema';
    import RNFetchBlob from 'rn-fetch-blob';

    const getAppGroupPath = (): string => {
      let path = '';

      if (Platform.OS === 'ios') {
        path = `${RNFetchBlob.fs.syncPathAppGroup('group.com.example.MyAwesomeApp')}/`;
      }

      return path;
    }

    const adapter = new SQLiteAdapter({
      dbName: `${getAppGroupPath()}default.db`,
      schema,
    });

    const database = new Database({
      adapter,
      modelClasses: [
        ...
      ],
    });

    export default database;
    ```

**Option B**: Via native Swift / Objective-C

1. Through Xcode, repeat this process for your **main target** and **every other target** that you want to share the database with:
    - Edit `Info.plist`
    - Add a new row with `AppGroup` as key and `group.$(PRODUCT_BUNDLE_IDENTIFIER)` (set up in Step 1) as value.

2. Right-click your project name and click **New Group**.
3. Add a file named `AppGroup.m` and paste the following:
    ```
    #import "React/RCTBridgeModule.h"
    @interface RCT_EXTERN_MODULE(AppGroup, NSObject)
    @end
    ```
4. Add a file named `AppGroup.swift` and paste the following:
    ```
   import Foundation

   @objc(AppGroup)
   class AppGroup: NSObject {

     @objc
     func constantsToExport() -> [AnyHashable : Any]! {
       var path = ""
       if let suiteName = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String {
         if let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName) {
           path = directory.path
         }
       }

       return ["path": "\(path)/"]
     }
   }
    ```
   This reads your new `Info.plist` row and exports a constant called `path` with your App Group path (shared directory path), to be used in your JS code.

5. In your JS, when creating the database, import the `path` constant from your new `AppGroup` module and prepend to your `dbName`:

    ```ts
    import { NativeModules, Platform } from 'react-native';
    import { Database } from '@nozbe/watermelondb';
    import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
    import schema from './schema';

    const getAppGroupPath = (): string => {
      let path = '';

      if (Platform.OS === 'ios') {
        path = NativeModules.AppGroup.path;
      }

      return path;
    }

    const adapter = new SQLiteAdapter({
      dbName: `${getAppGroupPath()}default.db`,
      schema,
    });

    const database = new Database({
      adapter,
      modelClasses: [
        ...
      ],
    });

    export default database;
    ```

This way you're telling Watermelon to store your database into the shared directories, you're ready to go!
