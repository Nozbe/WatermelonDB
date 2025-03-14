# 关系（Relations）

`Relation` 对象表示一条记录指向另一条记录的关系，例如 `Comment` 的作者（`User`），或者该评论所属的 `Post`。

### 定义关系

定义关系需要两个步骤：

1. 为相关记录的 ID 创建一个[**表列**](./Schema.md)

   ```js
   tableSchema({
     name: 'comments',
     columns: [
       // ...
       { name: 'author_id', type: 'string' },
     ]
   }),
   ```
2. 在 `Model` 类上定义一个 `@relation` 字段 [在 `Model` 类中定义](./Model.md)：

   ```js
   import { relation } from '@nozbe/watermelondb/decorators'

   class Comment extends Model {
     // ...
     @relation('users', 'author_id') author
   }
   ```

   第一个参数是相关记录的_表名_，第二个参数是包含相关记录 ID 的_列名_。

### immutableRelation

如果你有一个不会改变的关系（例如，评论不能更改其作者），可以使用 `@immutableRelation` 来获得额外的保护和性能提升：

```js
import { immutableRelation } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @immutableRelation('posts', 'post_id') post
  @immutableRelation('users', 'author_id') author
}
```

## 关系 API

在上面的示例中，`comment.author` 返回一个 `Relation` 对象。

> 请记住，WatermelonDB 是一个懒加载数据库，因此你不会立即获取到相关的 `User` 记录，只有在你显式地获取它时才会获取到。

### 观察

大多数情况下，你可以使用 `observe()` 方法将关系连接到组件 [将关系连接到组件](./Components.md)（与 [查询操作相同](./Query.md)）：

```js
withObservables(['comment'], ({ comment }) => ({
  comment,
  author: comment.author, // 等同于 `author: comment.author.observe()` 的快捷语法
}))
```

现在，组件将有一个包含 `User` 对象的 `author` 属性，并且当用户信息发生变化（例如，评论的作者更改了其姓名）时，或者当新的作者被分配给评论时（如果允许的话），组件都会重新渲染。

### 获取

若要简单地获取相关记录，可使用 `fetch` 方法。你可能会在 [写入器（Writer）](./Writers.md) 中用到它。

```js
const author = await comment.author.fetch()

// 快捷语法：
const author = await comment.author
```

**注意**：如果关系列（在本示例中为 `author_id`）被标记为 `isOptional: true`，`fetch()` 方法可能会返回 `null`。

### ID

如果你只需要相关记录的 ID（例如，用于 URL 或 React 的 `key=` 属性），可以使用 `id`。

```js
const authorId = comment.author.id
```

### 赋值

使用 `set()` 方法为关系指定一个新的记录。

```js
await database.get('comments').create(comment => {
  comment.author.set(someUser)
  // ...
})
```

**注意**：你只能在 `.create()` 或 `.update()` 代码块中执行此操作。

如果你仅拥有要指定记录的 ID，也可以使用 `set id`。

```js
await comment.update(() => {
  comment.author.id = userId
})
```

## 高级关系

### 多对多关系

例如，如果我们的应用中 `Post` 可以由多个 `User` 创作，并且一个用户可以创作多个 `Post`。我们可以按照以下步骤创建这样的关系：

1. 创建一个关联表的模式（Schema）和模型（Model），`User` 模型和 `Post` 模型都与之关联；例如 `PostAuthor`。
2. 在 `User` 和 `Post` 上创建 `has_many` 关联，指向 `PostAuthor` 模型。
3. 在 `PostAuthor` 上创建 `belongs_to` 关联，分别指向 `User` 和 `Post`。
4. 通过定义一个查询，使用关联表 `PostAuthor` 来推断某个用户创作的所有 `Post`，从而获取该用户的所有 `Post`。

```js
import { lazy } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'
  static associations = {
    post_authors: { type: 'has_many', foreignKey: 'post_id' },
  }

  @lazy
  authors = this.collections
    .get('users')
    .query(Q.on('post_authors', 'post_id', this.id));
}
```

```js
import { immutableRelation } from '@nozbe/watermelondb/decorators'

class PostAuthor extends Model {
  static table = 'post_authors'
  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' },
    users: { type: 'belongs_to', key: 'user_id' },
  }
  @immutableRelation('posts', 'post_id') post
  @immutableRelation('users', 'user_id') user
}

```

```js
import { lazy } from '@nozbe/watermelondb/decorators'

class User extends Model {
  static table = 'users'
  static associations = {
    post_authors: { type: 'has_many', foreignKey: 'user_id' },
  }

  @lazy
  posts = this.collections
    .get('posts')
    .query(Q.on('post_authors', 'user_id', this.id));

}
```

```js
withObservables(['post'], ({ post }) => ({
  authors: post.authors,
}))
```

* * *

## 下一步

➡️ 现在，本指南的最后一步：[**了解写入器（和读取器）**](./Writers.md)
