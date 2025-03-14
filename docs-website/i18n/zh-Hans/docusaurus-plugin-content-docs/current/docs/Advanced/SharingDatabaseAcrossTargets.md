# iOS - 在多个目标间共享数据库

如果你有多个 Xcode 目标，并且想在它们之间共享 WatermelonDB 实例，有两种方法可供选择：通过 JavaScript 或通过原生 Swift / Objective-C。

### 何时使用此方法

当你想在两个或更多 Xcode 目标（如通知服务扩展、共享扩展、iMessage 贴纸等）中访问相同的数据库数据时。

### 如何操作

**步骤 1：** 设置应用程序组

通过 Xcode，为你的**主目标**和所有你想与之共享数据库的**其他目标**重复以下操作：
- 点击目标名称
- 点击 **签名与功能（Signing and Capabilities）**
- 点击 **+ 功能（+ Capability）**
- 选择 **应用程序组（App Groups）**
- 提供你的应用程序组名称，通常为 `group.$(PRODUCT_BUNDLE_IDENTIFIER)`（例如：`group.com.example.MyAwesomeApp`）

> 注意：每个目标的应用程序组名称必须**完全相同**

这会告知 iOS 在你的目标之间共享存储目录，在这种情况下，也包括 Watermelon 数据库。

**步骤 2：** 设置 `dbName`

**选项 A：** 通过 JavaScript

> 注意：虽然这种方法更简单，但它有一个缺点，即会破坏 Chrome 远程调试功能

1. 安装 [rn-fetch-blob](https://github.com/joltup/rn-fetch-blob#installation)

2. 在你的 JavaScript 代码中，创建数据库时，使用 `rn-fetch-blob` 获取应用程序组路径：

    ```ts
    import { NativeModules, Platform } from 'react-native';
    import { Database } from '@nozbe/watermelondb';
    import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
    import schema from './schema';
    import RNFetchBlob from 'rn-fetch-blob';

    // 获取应用程序组路径
    const getAppGroupPath = (): string => {
      let path = '';

      if (Platform.OS === 'ios') {
        path = `${RNFetchBlob.fs.syncPathAppGroup('group.com.example.MyAwesomeApp')}/`;
      }

      return path;
    }

    const adapter = new SQLiteAdapter({
      // 设置数据库名称，使用应用程序组路径
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

**选项 B：** 通过原生 Swift / Objective-C

1. 通过 Xcode，为你的**主目标**和所有你想与之共享数据库的**其他目标**重复以下操作：
    - 编辑 `Info.plist` 文件
    - 添加一个新行，键为 `AppGroup`，值为 `group.$(PRODUCT_BUNDLE_IDENTIFIER)`（在步骤 1 中设置的值）。

2. 右键点击你的项目名称，然后点击**新建组**。
3. 添加一个名为 `AppGroup.m` 的文件，并粘贴以下内容：
    ```objc
    #import "React/RCTBridgeModule.h"
    @interface RCT_EXTERN_MODULE(AppGroup, NSObject)
    @end
    ```
4. 添加一个名为 `AppGroup.swift` 的文件，并粘贴以下内容：
    ```swift
    import Foundation

    @objc(AppGroup)
    class AppGroup: NSObject {

      @objc
      func constantsToExport() -> [AnyHashable : Any]! {
        var path = ""
        // 从 Info.plist 中获取 AppGroup 的值
        if let suiteName = Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String {
          // 获取应用程序组的容器 URL
          if let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName) {
            path = directory.path
          }
        }

        return ["path": "\(path)/"]
      }
    }
    ```
    这段代码读取你在 `Info.plist` 中新增的行，并导出一个名为 `path` 的常量，其值为你的应用程序组路径（共享目录路径），以便在你的 JavaScript 代码中使用。

5. 在你的 JavaScript 代码中，创建数据库时，从新的 `AppGroup` 模块导入 `path` 常量，并将其添加到 `dbName` 前面：

    ```ts
    import { NativeModules, Platform } from 'react-native';
    import { Database } from '@nozbe/watermelondb';
    import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
    import schema from './schema';

    // 获取应用程序组路径
    const getAppGroupPath = (): string => {
      let path = '';

      if (Platform.OS === 'ios') {
        path = NativeModules.AppGroup.path;
      }

      return path;
    }

    const adapter = new SQLiteAdapter({
      // 设置数据库名称，使用应用程序组路径
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

通过这种方式，你告知 Watermelon 将数据库存储到共享目录中，这样就可以了！
