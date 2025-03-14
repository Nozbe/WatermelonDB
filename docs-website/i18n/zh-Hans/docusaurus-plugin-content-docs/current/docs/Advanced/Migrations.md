### 迁移（Migrations）

**模式迁移（Schema migrations）** 是一种机制，通过它你可以以向后兼容的方式向数据库添加新的表和列。

如果不使用迁移，当你的应用程序用户从一个版本升级到另一个版本时，他们的本地数据库在启动时将被清空，从而丢失所有数据。

⚠️ 始终使用迁移功能！

## 迁移配置

1. 为迁移添加一个新文件：

   ```js
   // app/model/migrations.js

   import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

   export default schemaMigrations({
     migrations: [
       // 稍后我们将在这里添加迁移定义
     ],
   })
   ```

2. 将迁移功能集成到数据库适配器设置中：

   ```js
   // index.js
   import migrations from 'model/migrations'

   const adapter = new SQLiteAdapter({
     schema: mySchema,
     migrations,
   })
   ```

## 迁移工作流程

当你使用迁移功能进行模式更改时，请务必按照以下特定顺序操作，以最大程度地减少出错的可能性。

### 步骤 1: 添加新的迁移

首先，定义迁移 - 即定义两个版本的模式之间发生的 **更改**（例如添加新表或新表列）。

**暂时不要更改模式文件！**

```js
// app/model/migrations.js

import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      // ⚠️ 将此值设置为比当前模式版本大 1 的数字
      toVersion: 2,
      steps: [
        // 更多详细信息请参阅 "迁移 API"
        createTable({
          name: 'comments',
          columns: [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'body', type: 'string' },
          ],
        }),
      ],
    },
  ],
})
```

刷新模拟器/浏览器。你应该会看到以下错误：

> 迁移版本不能高于模式版本。模式版本为 1，而迁移覆盖范围是从 1 到 2

如果是这样，很好，请继续下一步！

但你可能也会看到类似 "模式中缺少表名" 的错误，这意味着你在定义迁移时出错了。有关详细信息，请参阅下面的 ["迁移 API"](#migrations-api)。

### 步骤 2：在模式中进行匹配更改

现在是时候对模式文件进行实际更改了 —— 添加与迁移定义中相同的表或列。

⚠️ 请再三检查你对模式所做的更改是否与迁移中定义的更改完全匹配。否则，可能会出现用户迁移时应用程序可以正常工作，但全新安装时却会失败的情况，反之亦然。

⚠️ 暂时不要更改模式版本。

```js
// model/schema.js

export default appSchema({
  version: 1,
  tables: [
    // 这是我们的新表！
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string' },
      ],
    }),
    // ...
  ]
})
```

刷新模拟器。你应该会再次看到相同的 “迁移版本不能高于模式版本” 错误。如果你看到了不同的错误，说明你存在语法错误。

### 步骤 3：提升模式版本

既然我们已经在模式（表和列的真实来源）和迁移（表和列的更改）中进行了匹配的更改，现在是时候通过提升版本来确认这些更改了：

```js
// model/schema.js

export default appSchema({
  version: 2,
  tables: [
    // ...
  ]
})
```

如果你再次刷新，应用程序应该能正常显示 —— 现在你就可以使用新的表/列了。

### 步骤 4：测试你的迁移

在发布应用程序的新版本之前，请检查你的数据库更改是否都兼容：

1. 迁移测试：安装应用程序的上一个版本，然后更新到你即将发布的版本，确保应用程序仍然可以正常工作。
2. 全新模式安装测试：卸载应用程序，然后安装应用程序的 _新_ 版本，确保它可以正常工作。

### 为什么这个顺序很重要

这仅仅是因为 React Native 模拟器（通常还有 React 网页项目）被配置为在你保存文件时自动刷新。你不希望数据库在更改存在错误或尚未完成的情况下意外迁移（升级）。通过先进行迁移，最后提升版本，你可以再次检查是否存在错误。

## 迁移 API

每次迁移必须迁移到比上一次迁移版本高一个版本，并且可以有多个 _步骤_（例如添加新表或新列）。下面是一个更完整的示例：

```js
schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'comments',
          columns: [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'body', type: 'string' },
          ],
        }),
        addColumns({
          table: 'posts',
          columns: [
            { name: 'subtitle', type: 'string', isOptional: true },
            { name: 'is_pinned', type: 'boolean' },
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        // ...
      ],
    },
  ],
})
```

### 迁移步骤：

- `createTable({ name: 'table_name', columns: [ ... ] })` - 与 `tableSchema()` 的 API 相同
- `addColumns({ table: 'table_name', columns: [ ... ] })` - 你可以向现有表中添加一个或多个列。列的格式与模式定义中的格式相同
- 其他类型的迁移（例如删除或重命名表和列）尚未实现。请参阅 [`migrations/index.js`](https://github.com/Nozbe/WatermelonDB/blob/master/src/Schema/migrations/index.js)。欢迎贡献代码！

## 数据库重置和其他边缘情况

1. 当你 **不** 使用迁移功能时，只要你更改模式版本，数据库就会重置（删除所有内容）。
2. 如果迁移失败，数据库将无法初始化，并会回滚到上一个版本。这种情况不太可能发生，但例如，如果你创建了一个试图两次创建同一张表的迁移，就可能会出现这种情况。数据库选择失败而不是重置，是为了避免丢失用户数据（在开发过程中也不容易造成混淆）。你可以发现问题，修复迁移，然后再次发布，而不会丢失数据。
3. 当运行中的应用程序的数据库版本比代码中定义的模式版本 *新* 时，数据库将重置（清空其内容）。这在开发过程中很有用。
4. 如果没有可用的迁移路径（例如，用户的应用程序数据库版本为 4，但最早的迁移是从版本 10 到 11），数据库将重置。

### 回滚更改

Watermelon 没有自动 “回滚” 功能。如果你在开发过程中在迁移时犯了错误，请按以下顺序回滚：

1. 注释掉对 `schema.js` 所做的任何更改
2. 注释掉对 `migrations.js` 所做的任何更改
3. 降低模式版本号（恢复原始版本号）

刷新应用程序后，数据库应该会重置到上一个状态。现在你可以纠正错误并再次应用更改（请按照 “迁移工作流程” 中描述的顺序进行操作）。

### 不安全的 SQL 迁移

与 [模式（Schema）](../Schema.md) 类似，你可以为每个迁移步骤添加 `unsafeSql` 参数，以修改或替换 WatermelonDB 生成的用于执行迁移的 SQL。还有一个 `unsafeExecuteSql('some sql;')` 步骤，你可以使用它来追加额外的 SQL。对于 LokiJSAdapter 和 [迁移同步](../Sync/Intro.md)，这些参数会被忽略。
