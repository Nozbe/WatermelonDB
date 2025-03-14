---
title: Flow
hide_title: true
---

# Watermelon ❤️ Flow

Watermelon 是在考虑了 [Flow](https://flow.org) 的情况下开发的。

如果您自己也是 Flow 用户（我们强烈推荐使用它！），以下是一些您需要记住的事项：

## 配置

将以下内容添加到您的 `.flowconfig` 文件中，以便 Flow 能够识别 Watermelon 的类型。

```ini
[declarations]
<PROJECT_ROOT>/node_modules/@nozbe/watermelondb/.*

[options]

module.name_mapper='^@nozbe/watermelondb\(.*\)$' -> '<PROJECT_ROOT>/node_modules/@nozbe/watermelondb/src\1'
```

请注意，如果您将整个 `node_modules/` 文件夹放在 `[ignore]` 部分下，这将不起作用。在这种情况下，请将其修改为仅忽略在您的应用中引发错误的特定节点模块，以便 Flow 可以扫描 Watermelon 文件。

## 表和列

在 Flow 中，表名和列名是 **不透明类型**。

因此，如果您尝试使用简单的字符串，如下所示：

```js
class Comment extends Model {
  static table = 'comments'

  @text('body') body
}
```

您会收到错误，因为您在期望 `TableName<Comment>` 的地方传递了 `'comments'`（一个 `string`），在期望 `ColumnName` 的地方传递了 `'body'`（同样是一个 `string`）。

在将 Watermelon 与 Flow 一起使用时，您必须在一个地方预定义所有表名和列名，然后在其他所有地方仅使用这些符号（而不是字符串）。

我们建议像这样定义符号：

```js
// File: model/schema.js
// @flow

import { tableName, columnName, type TableName, appSchema, tableSchema } from '@nozbe/watermelondb'
import type Comment from './Comment.js'

export const Tables = {
  comments: (tableName('comments'): TableName<Comment>),
  // ...
}

export const Columns = {
  comments: {
    body: columnName('body'),
    // ...
  }
}

export const appSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: Tables.comments,
      columns: [
        { name: Columns.comments.body, type: 'string' },
      ],
    }),
    // ...
  ]
})
```

然后像这样使用它们：

```js
// File: model/Comment.js
// @flow

import { Model } from '@nozbe/watermelondb'
import { text } from '@nozbe/watermelondb/decorators'

import { Tables, Columns } from './schema.js'

const Column = Columns.comments

export default class Comment extends Model {
  static table = Tables.comments

  @text(Column.body) body: string
}
```

### 这不是有很多样板代码吗？

是的，与非 Flow 示例相比，它看起来有更多的样板代码，但是：

- 您可以避免拼写错误 — 字符串只定义一次
- 更容易重构 — 您只需在一个地方更改列名
- 没有孤立的列或表 — 不会意外引用从模式中移除的列或表
- `TableName` 带有它所引用的模型类的类型，这使得 Flow 可以发现您代码中的其他错误

一般来说，我们发现未类型化的字符串常量会导致错误，而定义类型化的常量是一种良好的实践。

### 关联关系

在使用 Flow 时，您可以像这样定义模型关联关系：

```js
import { Model, associations } from '@nozbe/watermelondb'
import { Tables, Columns } from './schema.js'

const Column = Columns.posts

class Post extends Model {
  static table = Tables.posts
  static associations = associations(
    [Tables.comments, { type: 'has_many', foreignKey: Columns.comments.postId }],
    [Tables.users, { type: 'belongs_to', key: Column.authorId }],
  )
}
```

## 常见类型

许多类型都带有它们所引用的模型类的标签：

```js
TableName<Post> // 引用 posts 表的表名
Collection<Post> // posts 表的集合
Relation<Comment> // 可以获取 Comment 的关联关系
Relation<?Comment> // 可以获取 Comment 或 `null` 的关联关系
Query<Comment> // 可以获取多个 Comment 的查询
```

始终标记模型字段的类型。如果底层表列是可选的，请记得包含 `?`。Flow 无法检查模型字段是否与模式匹配，或者是否与装饰器的签名匹配。

```js
@text(Column.body) body: string
@date(Column.createdAt) createdAt: Date
@date(Column.archivedAt) archivedAt: ?Date
```

如果您需要引用记录的 ID，请始终使用 `RecordId` 类型别名，而不是 `string`（它们是相同的，但前者具有自文档性）。

如果您需要访问记录的原始数据（除非您 *真的* 知道自己在做什么，否则不要这样做），请使用 `DirtyRaw` 来引用来自外部源（数据库、服务器）的原始数据，使用 `RawRecord` 来引用经过 `sanitizedRaw` 处理后的原始数据。
