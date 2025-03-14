# 模式（Schema）

在使用 WatermelonDB 时，你会涉及到 **模型（Models）** 和 **集合（Collections）**。然而，WatermelonDB 底层依赖于 **基础数据库**（如 SQLite 或 LokiJS），这些数据库使用的是不同的术语：**表（tables）** 和 **列（columns）**。这些表和列共同构成了 **数据库模式（database schema）**，我们必须先对其进行定义。

## 定义数据库模式

假设你想在应用中使用 `Post` 和 `Comment` 模型。对于每个模型，你需要定义一个表；对于模型的每个字段（例如博客文章的标题、评论的作者），你需要定义一个列。例如：

```js
// model/schema.js
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'posts',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'subtitle', type: 'string', isOptional: true },
        { name: 'body', type: 'string' },
        { name: 'is_pinned', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'body', type: 'string' },
        { name: 'post_id', type: 'string', isIndexed: true },
      ]
    }),
  ]
})
```

**注意**：按照数据库的命名约定，表名通常使用复数形式和蛇形命名法（snake_case），列名也使用蛇形命名法。因此，`Post` 对应的表名是 `posts`，`createdAt` 对应的列名是 `created_at`。

### 列类型

列有三种类型：`string`、`number` 或 `boolean`。

如果你在创建记录时遗漏了某个字段，这些类型的字段将分别默认设置为 `''`、`0` 或 `false`。

若要允许字段为 `null`，请将列标记为 `isOptional: true`。

### 命名约定

若要在表中添加关联关系（例如，`Comment` 所属的 `Post`，或评论的作者），可添加一个以 `_id` 结尾的字符串列：

```js
{ name: 'post_id', type: 'string' },
{ name: 'author_id', type: 'string' },
```

布尔类型的列名应以 `is_` 开头：

```js
{ name: 'is_pinned', type: 'boolean' }
```

日期字段应使用 `number` 类型（日期以 Unix 时间戳形式存储），且列名应以 `_at` 结尾：

```js
{ name: 'last_seen_at', type: 'number', isOptional: true }
```

### 特殊列

所有表都会 **自动** 包含一个名为 `id` 的字符串列，用于唯一标识记录，因此你不能自己声明名为 `id` 的列。（此外，还有用于 [同步](./Sync/Intro.md) 的特殊列 `_status` 和 `_changed`，你不应该手动修改它们。）

你可以添加特殊的 `created_at` / `updated_at` 列，以启用 [自动创建/更新跟踪](./Advanced/CreateUpdateTracking.md)。

### 修改数据库模式

WatermelonDB 无法自动检测数据库模式的更改。因此，每当你更改数据库模式时，必须增加其版本号（`version` 字段）。

在开发早期，你只需这样做即可。应用重新加载时，这将导致数据库被完全清空。

若要无缝更新数据库模式（不删除用户数据），请使用 [迁移（Migrations）](./Advanced/Migrations.md)。

⚠️ 如果你已经发布了应用，一定要使用迁移功能。

### 索引

若要启用数据库索引，可在列定义中添加 `isIndexed: true`。

索引可以加快按列查询的速度，但会降低创建/更新的速度，并增加数据库的大小。

例如，如果你经常查询某个帖子的所有评论（即通过 `post_id` 列查询评论），则应将 `post_id` 列标记为索引列。

然而，如果你很少按作者查询所有评论，那么为 `author_id` 列创建索引可能就不值得了。

一般来说，大多数 `_id` 字段都会创建索引。偶尔，`boolean` 字段也值得创建索引（但这是一种“低质量索引”）。不过，你几乎不应该为日期（`_at`）列或 `string` 列创建索引，尤其不要为长文本的用户输入创建索引。

⚠️ 不要为了“让 WatermelonDB 更快”而将所有列都标记为索引列。索引会带来实际的性能开销，应仅在必要时使用。

## 高级用法

### 不安全的 SQL 模式

如果你想修改用于设置 SQLite 数据库的 SQL 语句，可以向 `tableSchema` 和 `appSchema` 传递 `unsafeSql` 参数。该参数是一个函数，它接收 WatermelonDB 生成的 SQL 语句，你可以返回任意内容，比如在 SQL 语句前后添加内容、替换部分内容，或者返回你自己的 SQL 语句。当传递给 `tableSchema` 时，它接收的是为该表生成的 SQL 语句；当传递给 `appSchema` 时，它接收的是整个数据库模式的 SQL 语句。

⚠️ 请注意，WatermelonDB 生成的 SQL 语句不被视为稳定的 API，因此在进行转换时要格外小心，因为它们可能随时会失效。

```js
appSchema({
  ...
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [...],
      unsafeSql: sql => sql.replace(/create table [^)]+\)/, '$& without rowid'),
    }),
  ],
  unsafeSql: (sql, kind) => {
    // 注意，这个函数不仅在首次设置数据库时会被调用
    // 此外，在执行非常大的批量操作时，为了优化性能，所有数据库索引可能会被删除，之后再重新创建。
    // 未来可能会添加更多类型。
    switch (kind) {
      case 'setup':
        return `create blabla;${sql}`
      case 'create_indices':
      case 'drop_indices':
        return sql
      default:
        throw new Error('unexpected unsafeSql kind')
    }
  },
})
```

* * *

## 下一步

➡️ 定义好数据库模式后，接下来可以 [**定义你的模型**](./Model.md)
