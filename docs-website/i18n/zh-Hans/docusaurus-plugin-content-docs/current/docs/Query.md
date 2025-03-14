---
title: 查询
hide_title: true
---

# 查询 API

**查询** 是指查找符合特定条件的记录的操作，例如：

- 查找属于某篇特定文章的所有评论
- 查找由 John 发表的所有 _已验证_ 评论
- 统计 John 或 Lucy 在过去两周内发表的文章下发布的所有已验证评论的数量

由于查询是在数据库中执行的，而不是在 JavaScript 中执行，因此它们的速度非常快。这也是 Watermelon 即使在大规模数据下也能保持快速响应的原因，因为即使总共有数以万计的记录，在应用启动时你通常也只需要加载几十条记录。

## 定义查询

### @children

最简单的查询是使用 `@children` 进行的。这将为属于 `Post` 的所有评论定义一个 `Query`：

```js
class Post extends Model {
  // ...
  @children('comments') comments
}
```

**➡️ 了解更多：** [定义模型](./Model.md)

### 扩展查询

要 **缩小** 一个 `Query` 的范围（为现有查询添加 [额外条件](#query-conditions)），可以使用 `.extend()`：

```js
import { Q } from '@nozbe/watermelondb'
import { children, lazy } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @children('comments') comments

  @lazy verifiedComments = this.comments.extend(
    Q.where('is_verified', true)
  )

  @lazy verifiedAwesomeComments = this.verifiedComments.extend(
    Q.where('is_awesome', true)
  )
}
```

**注意：** 为了提高性能，在扩展或定义新查询时请使用 `@lazy`。

### 自定义查询

你可以按如下方式查询任何表：

```js
import { Q } from '@nozbe/watermelondb'

const users = await database.get('users').query(
  // 用户必须满足的条件：
  Q.on('comments', 'post_id', somePostId)
).fetch()
```

这将获取在 `id = somePostId` 的文章下发表过评论的所有用户。

你可以在模型上定义自定义查询，如下所示：

```js
class Post extends Model {
  // ...
  @lazy commenters = this.collections.get('users').query(
    Q.on('comments', 'post_id', this.id)
  )
}
```

## 执行查询

大多数情况下，你可以通过将查询连接到 React 组件来执行查询，如下所示：

```js
withObservables(['post'], ({ post }) => ({
  post,
  comments: post.comments,
  verifiedCommentCount: post.verifiedComments.observeCount(),
}))
```

**➡️ 了解更多：** [连接到组件](./Components.md)

### 获取数据

若只需获取当前列表或当前数量（不观察未来的变化），可使用 `fetch` / `fetchCount`。

```js
const comments = await post.comments.fetch()
const verifiedCommentCount = await post.verifiedComments.fetchCount()

// 便捷语法：
const comments = await post.comments
const verifiedCommentCount = await post.verifiedComments.count
```

## 查询条件

```js
import { Q } from '@nozbe/watermelondb'
// ...
database.get('comments').query(
  Q.where('is_verified', true)
)
```

此查询将查找 **所有** 已验证的评论（所有满足一个条件的评论：评论的 `is_verified` 列必须为 `true`）。

在设置条件时，你需要引用表的 [**列名**](./Schema.md)（即 `is_verified`，而不是 `isVerified`）。这是因为查询是直接在底层数据库上执行的。

第二个参数是我们要查询的值。请注意，传递的参数必须与列的类型相同（`string`、`number` 或 `boolean`；只有当列在模式中标记为 `isOptional: true` 时，才允许使用 `null`）。

### 空查询

```js
const allComments = await database.get('comments').query().fetch()
```

没有条件的查询将查找集合中的 **所有** 记录。

**注意：** 除非必要，否则不要这样做。通常，只查询你需要的确切记录会更高效。

### 多个条件

```js
database.get('comments').query(
  Q.where('is_verified', true),
  Q.where('is_awesome', true)
)
```

此查询将查找 **既** 已验证 **又** 很棒的所有评论。

### 带其他运算符的条件

| 查询 | 等效的 JavaScript 代码 |
| ------------- | ------------- |
| `Q.where('is_verified', true)` | `is_verified === true`（快捷语法） |
| `Q.where('is_verified', Q.eq(true))` | `is_verified === true` |
| `Q.where('archived_at', Q.notEq(null))` | `archived_at !== null` |
| `Q.where('likes', Q.gt(0))` | `likes > 0`  |
| `Q.where('likes', Q.weakGt(0))` | `likes > 0`（语义略有不同 — [详见 "null 行为"](#null-behavior)） |
| `Q.where('likes', Q.gte(100))` | `likes >= 100` |
| `Q.where('dislikes', Q.lt(100))` | `dislikes < 100` |
| `Q.where('dislikes', Q.lte(100))` | `dislikes <= 100` |
| `Q.where('likes', Q.between(10, 100))` | `likes >= 10 && likes <= 100` |
| `Q.where('status', Q.oneOf(['published', 'draft']))` | `['published', 'draft'].includes(status)` |
| `Q.where('status', Q.notIn(['archived', 'deleted']))` | `status !== 'archived' && status !== 'deleted'` |
| `Q.where('status', Q.like('%bl_sh%'))` | `/.*bl.sh.*/i`（见下方注释！） |
| `Q.where('status', Q.notLike('%bl_sh%'))` | `/^((!?.*bl.sh.*).)*$/i`（反向正则匹配）（见下方注释） |
| `Q.where('status', Q.includes('promoted'))` | `status.includes('promoted')` |

### LIKE / NOT LIKE

你可以使用 `Q.like` 进行与搜索相关的任务。例如，要查找所有用户名以 "jas" 开头（不区分大小写）的用户，你可以这样写：

```js
usersCollection.query(
  Q.where("username", Q.like(`${Q.sanitizeLikeString("jas")}%`)
)
```

其中 `"jas"` 可以根据用户输入动态更改。

请注意，`Q.like` 的行为并不精确，在不同的实现（SQLite 与 LokiJS）之间可能会有所不同。例如，虽然比较是不区分大小写的，但 SQLite 默认情况下无法对非 ASCII 字符进行不区分大小写的比较（除非你安装 ICU 扩展）。使用 `Q.like` 进行用户输入搜索，但不要用于需要精确匹配行为的任务。

**注意：** 直接将用户输入与 `Q.like` 和 `Q.notLike` 一起使用是 **不安全** 的，因为像 `%` 或 `_` 这样的特殊字符不会被转义。始终像这样对用户输入进行清理：
```js
Q.like(`%${Q.sanitizeLikeString(userInput)}%`)
Q.notLike(`%${Q.sanitizeLikeString(userInput)}%`)
```

### AND/OR 嵌套

你可以使用 `Q.and` 和 `Q.or` 嵌套多个条件：

```js
database.get('comments').query(
  Q.where('archived_at', Q.notEq(null)),
  Q.or(
    Q.where('is_verified', true),
    Q.and(
      Q.where('likes', Q.gt(10)),
      Q.where('dislikes', Q.lt(5))
    )
  )
)
```

这等效于 `archivedAt !== null && (isVerified || (likes > 10 && dislikes < 5))`。

### 关联表的条件（“JOIN 查询”）

例如：查询 John 发表的文章下的所有评论：

```js
// 快捷语法：
database.get('comments').query(
  Q.on('posts', 'author_id', john.id),
)

// 完整语法：
database.get('comments').query(
  Q.on('posts', Q.where('author_id', Q.eq(john.id))),
)
```

通常，你会在要查询的表上设置条件。这里我们查询的是 **评论**，但我们对评论所属的 **文章** 设置了条件。

`Q.on` 的第一个参数是你要设置条件的表名。另外两个参数与 `Q.where` 的参数相同。

**注意：** 在使用 `Q.on` 之前，两个表 [必须关联](./Model.md)。

### 关联表的多个条件

例如：查询 John 撰写的、**并且** 已发布或属于 `draftBlog` 的文章下的所有评论

```js
database.get('comments').query(
  Q.on('posts', [
    Q.where('author_id', john.id)
    Q.or(
      Q.where('published', true),
      Q.where('blog_id', draftBlog.id),
    )
  ]),
)
```

你也可以将 `Q.and`、`Q.or`、`Q.where` 或 `Q.on` 作为 `Q.on` 的第二个参数，而不是传递条件数组。

### 在 AND/OR 中嵌套 `Q.on`

如果你想在 `Q.and` 和 `Q.or` 中嵌套 `Q.on`，则必须明确定义你要连接的所有表。（注意：`Q.experimentalJoinTables` API 可能会发生变化）

```js
tasksCollection.query(
  Q.experimentalJoinTables(['projects']),
  Q.or(
    Q.where('is_followed', true),
    Q.on('projects', 'is_followed', true),
  ),
)
```

### 深度 `Q.on` 查询

你还可以在 `Q.on` 内部嵌套 `Q.on`，例如，对祖父级表设置条件。你必须明确定义要连接的表。（注意：`Q.experimentalNestedJoin` API 可能会发生变化）。允许进行多级嵌套。

```js
// 此查询用于查找那些 teams (团队) 下，位于 projects(项目) 中的 tasks (任务)，且满足 team.foo == 'bar' 条件
tasksCollection.query(
  Q.experimentalNestedJoin('projects', 'teams'),
  Q.on('projects', Q.on('teams', 'foo', 'bar')),
)
```

## 高级查询

### 高级观察

调用 `query.observeWithColumns(['foo', 'bar'])` 可以创建一个可观察对象，该对象不仅会在匹配记录列表发生变化（有新记录或记录被删除）时发出值，还会在任何匹配记录的 `foo` 或 `bar` 列发生变化时发出值。[在观察排序列表时使用此方法](./Components.md)

#### 计数节流

默认情况下，调用 `query.observeCount()` 会返回一个可观察对象，该对象会进行节流处理，最多每 250 毫秒发出一次值。你可以使用 `query.observeCount(false)` 禁用节流。

### 列比较

此查询用于查找点赞数多于踩数的评论。注意，这里我们是将 `likes` 列与另一列进行比较，而不是与一个具体的值进行比较。

```js
database.get('comments').query(
  Q.where('likes', Q.gt(Q.column('dislikes')))
)
```

### sortBy、take、skip

你可以使用这些子句按一个或多个列对查询结果进行排序。注意，目前仅支持简单的升序/降序排序规则。

```js
database.get('comments').query(
  // 按点赞数从多到少排序
  Q.sortBy('likes', Q.desc),
  // 如果两条评论的点赞数相同，则踩数最少的评论排在前面
  Q.sortBy('dislikes', Q.asc),
  // 跳过前 50 条评论，取 100 条评论
  Q.skip(50),
  Q.take(100),
)
```

在查询级别进行排序并不一定比在 JavaScript 中排序更好或更高效，**但是**，`Q.sortBy` 最重要的使用场景是与 `Q.skip` 和 `Q.take` 一起使用来实现分页功能，即限制从数据库加载到内存中的记录数量，以处理超长列表。

### 获取记录 ID

如果你只需要查询匹配记录的 ID，可以通过调用 `await query.fetchIds()` 来优化查询，而不是使用 `await query.fetch()`。

### 安全性

请记住，从安全角度来看，查询是一个敏感的话题。永远不要信任用户输入并将其直接传递到查询中。具体来说：

- 永远不要将你不确定类型的值传递到查询中（例如，传递给 `Q.eq()` 的值应该是字符串、数字、布尔值或 null，而不是对象。如果值来自 JSON，在传递之前必须对其进行验证！）
- 永远不要从用户输入中传递列名（除非进行了白名单过滤）
- 传递给 `oneOf`、`notIn` 的值应该是简单类型的数组，要确保它们不包含对象
- 在使用 `Q.like` / `Q.notLike` 时，必须使用 `Q.sanitizeLikeString` 进行处理
- 在不了解自己在做什么以及未对所有用户输入进行清理的情况下，不要使用 `不安全的原始查询`

### 不安全的 SQL 查询

```js
const records = await database.get('comments').query(
  Q.unsafeSqlQuery(`select * from comments where foo is not ? and _status is not 'deleted'`, ['bar'])
).fetch()

const recordCount = await database.get('comments').query(
  Q.unsafeSqlQuery(`select count(*) as count from comments where foo is not ? and _status is not 'deleted'`, ['bar'])
).fetchCount()
```

你也可以观察不安全的原始 SQL 查询，但是，如果查询中包含 `JOIN` 语句，你必须使用 `Q.experimentalJoinTables` 和/或 `Q.experimentalNestedJoin` 显式指定所有其他表，如下所示：

```js
const records = await database.get('comments').query(
  Q.experimentalJoinTables(['posts']),
  Q.experimentalNestedJoin('posts', 'blogs'),
  Q.unsafeSqlQuery(
    'select comments.* from comments ' +
      'left join posts on comments.post_id is posts.id ' +
      'left join blogs on posts.blog_id is blogs.id' +
      'where ...',
  ),
).observe()
```

⚠️ 请注意：

- 如果你不了解自己在做什么，请不要使用此方法
- 不要直接传递用户输入，以避免 SQL 注入攻击 - 使用 `?` 占位符并传递占位符值的数组
- 必须使用 `where _status is not 'deleted'` 子句过滤掉已删除的记录
- 如果你要获取查询结果的数量，请使用 `count(*) as count` 作为查询结果

### 不安全的原始数据获取

除了 `.fetch()` 和 `.fetchIds()` 之外，还有 `.unsafeFetchRaw()`。与返回 `Model` 类实例数组不同，它返回原始对象数组。

你可以将其作为一种不安全的优化手段使用，或者结合 `Q.unsafeSqlQuery`/`Q.unsafeLokiTransform` 来创建高级查询，这样可以跳过获取不必要的列，或者包含额外的计算列。例如：

```js
const rawData = await database.get('posts').query(
  Q.unsafeSqlQuery(
    'select posts.text1, count(tag_assignments.id) as tag_count, sum(tag_assignments.rank) as tag_rank from posts' +
      ' left join tag_assignments on posts.id = tag_assignments.post_id' +
      ' group by posts.id' +
      ' order by posts.position desc',
  )
).unsafeFetchRaw()
```

⚠️ 你绝对不能修改返回的对象。否则会破坏数据库。

### 不安全的 SQL/Loki 表达式

你还可以包含一些较小的 SQL 和 Loki 表达式，这样你就可以尽可能多地使用 Watermelon 查询构建器：

```js
// SQL 示例：
postsCollection.query(
  Q.where('is_published', true),
  Q.unsafeSqlExpr('tasks.num1 not between 1 and 5'),
)

// LokiJS 示例：
postsCollection.query(
  Q.where('is_published', true),
  Q.unsafeLokiExpr({ text1: { $contains: 'hey' } })
)
```

对于 SQL，当与其他表进行连接时，一定要在列名前加上表名作为前缀。

⚠️ 如果你不清楚自己在做什么，请不要使用此功能。不要直接传递用户输入，以避免 SQL 注入。

### 多表列比较和 `Q.unsafeLokiTransform`

示例：我们想要查询那些发布时间比所属文章发布时间晚 14 天以上的评论。

遗憾的是，没有内置的语法来实现这个需求，但可以通过使用不安全的表达式来解决：

```js
// SQL 示例：
commentsCollection.query(
  Q.on('posts', 'published_at', Q.notEq(null)),
  Q.unsafeSqlExpr(`comments.createad_at > posts.published_at + ${14 * 24 * 3600 * 1000}`)
)

// LokiJS 示例：
commentsCollection.query(
  Q.on('posts', 'published_at', Q.notEq(null)),
  Q.unsafeLokiTransform((rawRecords, loki) => {
    return rawRecords.filter(rawRecord => {
      const post = loki.getCollection('posts').by('id', rawRecord.post_id)
      return post && rawRecord.created_at > post.published_at + 14 * 24 * 3600 * 1000
    })
  }),
)
```

对于 LokiJS，要记住 `rawRecord` 是一个未经过清理的、不安全的对象，绝对不能对其进行修改。`Q.unsafeLokiTransform` 仅在使用 `LokiJSAdapter` 且 `useWebWorkers: false` 时有效。每个查询中只能有一个 `Q.unsafeLokiTransform` 子句。

### `null` 的处理规则

有一些需要注意的陷阱。`Q.gt`、`gte`、`lt`、`lte`、`oneOf`、`notIn`、`like` 这些操作符在处理 `null` 时遵循 SQLite 的语义，这与 JavaScript 不同。

**经验法则**：不允许进行 `null` 比较。

例如，如果你查询 `comments` 表，使用 `Q.where('likes', Q.lt(10))`，点赞数为 8 和 0 的评论会被包含在内，但点赞数为 `null` 的评论不会！在 Watermelon 查询中，`null` 不小于任何数字。这就是为什么除非确实需要，否则应该避免[将表列设置为可选](./Schema.md)。

同样，如果你进行列比较查询，例如 `Q.where('likes', Q.gt(Q.column('dislikes')))`，只有 `likes` 和 `dislikes` 都不为 `null` 的评论才会被比较。点赞数为 5 且踩数为 `null` 的评论不会被包含在内。在这里，5 并不大于 `null`。

**`Q.oneOf` 操作符**：不允许将 `null` 作为参数传递给 `Q.oneOf`。你需要像下面这样显式地允许 `null` 作为值，而不是使用 `Q.oneOf([null, 'published', 'draft'])`：

```js
postsCollection.query(
  Q.or(
    Q.where('status', Q.oneOf(['published', 'draft'])),
    Q.where('status', null)
  )
)
```

**`Q.notIn` 操作符**：如果你查询帖子，使用 `Q.where('status', Q.notIn(['published', 'draft']))`，它会匹配状态不是 `published` 或 `draft` 的帖子，但不会匹配状态为 `null` 的帖子。如果你想包含这些帖子，需要像上面的例子一样显式地进行查询。

**`Q.weakGt` 操作符**：这是 `Q.gt` 的弱类型版本，允许进行 `null` 比较。所以，如果你使用 `Q.where('likes', Q.weakGt(Q.column('dislikes')))` 查询 `comments` 表，点赞数为 5 且踩数为 `null` 的评论会被匹配到。（与标准操作符不同，对于 `weakGt`，任何数字都大于 `null`）。

## 为 Watermelon 查询语言贡献改进

以下是相关的文件。这份列表可能看起来让人望而生畏，但实际上添加新的匹配器相当简单，已有多位首次贡献者完成了此类改进（包括 `like`、`sort`、`take`、`skip`）。实现代码只是分散在多个文件（及其测试文件）中，当你查看这些文件时，通过类比很容易添加匹配器。

我们建议先编写测试来验证预期行为，然后再实现具体功能。

- `src/QueryDescription/test.js` - 测试子句构建器（如 `Q.myThing`）的输出，并验证它会拒绝不良或不安全的参数
- `src/QueryDescription/index.js` - 添加子句构建器和类型定义
- `src/__tests__/databaseTests.js` - 添加测试（若需要对关联表设置条件则用 “join”；否则用 “match”），以检查新子句是否能匹配预期的记录。基于此测试，会生成针对 SQLite、LokiJS 和 Matcher 的测试。（若不支持其中某一项，在测试中添加 `skip{Loki,Sql,Count,Matcher}: true`）
- `src/adapters/sqlite/encodeQuery/test.js` - 测试你的查询是否生成预期的 SQL。（若你的子句仅适用于 Loki，测试是否抛出错误）
- `src/adapters/sqlite/encodeQuery/index.js` - 生成 SQL
- `src/adapters/lokijs/worker/encodeQuery/test.js` - 测试你的查询是否生成预期的 Loki 查询（若你的子句仅适用于 SQLite，测试是否抛出错误）
- `src/adapters/lokijs/worker/encodeQuery/index.js` - 生成 Loki 查询
- `src/adapters/lokijs/worker/{performJoins/*.js,executeQuery.js}` - 某些 Loki 查询可能会用到这些文件，但大多数情况下你无需关注。
- `src/observation/encodeMatcher/` - 若你的查询可以在 JavaScript 中针对单条记录进行检查（例如，你正在添加新的 “按正则表达式” 匹配器），在此处（`index.js`、`operators.js`）实现该功能。这用于高效的 “简单观察”。你无需编写测试 —— 会自动使用 `databaseTests`。若你无法或不想为查询实现 `encodeMatcher`，在 `canEncode.js` 中添加检查，让它针对你的查询返回 `false`（届时将使用效率较低的 “重新加载观察”）。然后将你的查询添加到 `test.js` 的 “无法编码的查询” 列表中。

* * *

## 下一步

➡️ 既然你已经掌握了查询，接下来[**创建更多关联**](./Relation.md)
