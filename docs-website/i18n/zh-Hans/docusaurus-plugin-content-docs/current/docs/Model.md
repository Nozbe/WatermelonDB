# 模型（Model）

**模型（Model）** 类代表了你应用中的一种事物类型。例如，`Post`（文章）、`Comment`（评论）、`User`（用户）。

在定义一个模型之前，请确保你已经[定义了它的模式（Schema）](./Schema.md)。

## 创建一个模型

让我们来定义 `Post` 模型：

```js
// model/Post.js
import { Model } from '@nozbe/watermelondb'

export default class Post extends Model {
  static table = 'posts'
}
```

为这个模型指定表名 —— 这个表名要和你在[模式](./Schema.md)中定义的一致。

现在将新模型添加到 `Database` 中：

```js
// index.js
import Post from 'model/Post'

const database = new Database({
  // ...
  modelClasses: [Post],
})
```

### 关联关系

许多模型之间是相互关联的。一篇 `Post` 可以有多个 `Comment`。而每个 `Comment` 都属于一篇 `Post`。（每个关联关系都是双向的）。像这样定义这些关联关系：

```js
class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }
}

class Comment extends Model {
  static table = 'comments'
  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' },
  }
}
```

在“子”方（`comments`），你定义一个 `belongs_to` 关联关系，并传递一个指向父方的列名（键）（`post_id` 是评论所属文章的 ID）。

在“父”方（`posts`），你定义一个等效的 `has_many` 关联关系，并传递相同的列名（⚠️ 注意这里的名称是 `foreignKey`）。

## 添加字段

接下来，定义模型的_字段_（属性）。这些字段对应于你之前在模式中定义的[表列](./Schema.md)。

```js
import { field, text } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @text('title') title
  @text('body') body
  @field('is_pinned') isPinned
}
```

字段是使用 ES6 装饰器来定义的。将你在模式中定义的**列名**作为参数传递给 `@field`。

**字段类型**。字段的类型（字符串/数字/布尔值）保证和模式中定义的列类型一致。如果列被标记为 `isOptional: true`，字段也可能为 `null`。

**用户文本字段**。对于包含用户指定的任意文本的字段（例如姓名、标题、评论内容），使用 `@text` —— 它是 `@field` 的一个简单扩展，还会去除前后的空白字符。

**注意**：为什么我必须输入字段/列名两次？数据库的命名约定是使用 `蛇形命名法（snake_case）`，而 JavaScript 的命名约定是使用 `驼峰命名法（camelCase）`。所以对于任何多单词的名称，两者是不同的。此外，为了提高代码的健壮性，我们认为明确指定名称更好，因为随着时间的推移，你可能想要重构 JavaScript 字段名的命名方式，但为了向后兼容，列名必须保持不变。

### 日期字段

对于日期字段，请使用 `@date` 而不是 `@field`。这样会返回一个 JavaScript 的 `Date` 对象（而不是 Unix 时间戳整数）。

```js
import { date } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @date('last_event_at') lastEventAt
}
```

### 派生字段

使用 ES6 的 getter 来定义可以根据数据库字段计算得出的模型属性：

```js
import { field, text } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'

  @date('archived_at') archivedAt

  get isRecentlyArchived() {
    // 在过去 7 天内
    return this.archivedAt &&
      this.archivedAt.getTime() > Date.now() - 7 * 24 * 3600 * 1000
  }
}
```

### 一对一关系字段

要指向一个关联记录，例如 `Comment` 所属的 `Post`，或者 `Comment` 的作者（`User`），可以使用 `@relation` 或 `@immutableRelation`：

```js
import { relation, immutableRelation } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @relation('posts', 'post_id') post
  @immutableRelation('users', 'author_id') author
}
```

**➡️ 了解更多：** [关系 API](./Relation.md)

### 子记录（一对多关系字段）

要指向属于该模型的记录列表，例如属于 `Post` 的所有 `Comment`，可以使用 `@children` 定义一个简单的 `Query`：

```js
import { children } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @children('comments') comments
}
```

将关联记录的_表名_作为参数传递给 `@children`。得到的属性将是一个 `Query`，你可以对其进行获取、观察或计数操作。

**注意：** 要使此功能正常工作，你必须在 `static associations` 中定义一个 `has_many` 关联。

**➡️ 了解更多：** [查询（Query）](./Query.md)

### 自定义查询

除了 `@children`，你还可以定义自定义查询或扩展现有查询，例如：

```js
import { children } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @children('comments') comments
  @lazy verifiedComments = this.comments.extend(
    Q.where('is_verified', true)
  )
}
```

**➡️ 了解更多：** [查询（Query）](./Query.md)

### 写入方法

定义**写入方法**来简化记录的创建和更新操作，例如：

```js
import { writer } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  static table = 'comments'

  @field('is_spam') isSpam

  @writer async markAsSpam() {
    await this.update(comment => {
      comment.isSpam = true
    })
  }
}
```

方法必须标记为 `@writer` 才能修改数据库。

**➡️ 了解更多：** [写入方法（Writers）](./Writers.md)

## 高级字段

你还可以使用以下装饰器：

- `@json` 用于处理复杂的序列化数据
- `@readonly` 使字段变为只读
- `@nochange` 禁止在_首次创建后_对字段进行更改

你还可以使用 RxJS 创建可观察的复合属性…

**➡️ 了解更多：** [高级字段](./Advanced/AdvancedFields.md)

* * *

## 下一步

➡️ 定义了一些模型后，请学习 [**创建、读取、更新、删除 API**](./CRUD.md)
