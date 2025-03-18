---
title: '配置'
hide_title: true
---

# 为你的应用配置 WatermelonDB

在继续操作之前，请确保你已经[安装了 Watermelon](./Installation.mdx)。

在你的项目中创建 `model/schema.js` 文件。在[下一步](./Schema.md)中你会用到它。

```js
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    // 稍后我们会在这里添加 tableSchemas
  ]
})
```

同样地，创建 `model/migrations.js` 文件。（[关于迁移的更多信息](./Advanced/Migrations.md)）：

```js
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    // 稍后我们会在这里添加迁移定义
  ],
})
```

现在，在你的 `index.native.js` 文件中：

```js
import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './model/schema'
import migrations from './model/migrations'
// import Post from './model/Post' // ⬅️ 你将在这里导入你的模型

// 首先，创建底层数据库的适配器：
const adapter = new SQLiteAdapter({
  schema,
  // （出于开发目的，你可能需要注释掉这一行 -- 请参阅迁移文档）
  migrations,
  // （可选的数据库名称或文件系统路径）
  // dbName: 'myapp',
  // （推荐选项，在 iOS 上应该可以完美运行。在 Android 上，
  // 必须采取额外的安装步骤 -- 如果遇到问题请禁用）
  jsi: true, /* Platform.OS === 'ios' */
  // （可选，但你应该实现这个方法）
  onSetUpError: error => {
    // 数据库加载失败 -- 提示用户重新加载应用或注销
  }
})

// 然后，从适配器创建一个 Watermelon 数据库！
const database = new Database({
  adapter,
  modelClasses: [
    // Post, // ⬅️ 你将在这里向 Watermelon 添加模型
  ],
})
```

上述代码适用于 React Native（iOS/Android）和 NodeJS。对于 Web 环境，不要使用 `SQLiteAdapter`，而是使用 `LokiJSAdapter`：

```js
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({
  schema,
  // （出于开发目的，你可能想注释掉迁移部分 -- 请参阅迁移文档）
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  // dbName: 'myapp', // 可选的数据库名称

  // --- 可选但推荐的事件处理程序：

  onQuotaExceededError: (error) => {
    // 浏览器磁盘空间不足 -- 提示用户重新加载应用或注销
  },
  onSetUpError: (error) => {
    // 数据库加载失败 -- 提示用户重新加载应用或注销
  },
  extraIncrementalIDBOptions: {
    onDidOverwrite: () => {
      // 当此适配器被迫覆盖 IndexedDB 内容时调用。
      // 如果同一应用的另一个打开标签正在进行更改，就会发生这种情况。
      // 现在尝试同步应用，如果用户处于离线状态，提醒他们如果关闭此标签，某些数据可能会丢失
    },
    onversionchange: () => {
      // 数据库在另一个浏览器标签中被删除（用户注销），因此我们必须确保在这个标签中也删除它
      // 通常最好是刷新页面
      if (checkIfUserIsLoggedIn()) {
        window.location.reload()
      }
    },
  }
})

// 其余部分相同！
```

* * *

## 下一步

➡️ 安装 Watermelon 后，[**定义你应用的模式（Schema）**](./Schema.md)
