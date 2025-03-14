---
title: 写入器、读取器与批量操作
hide_title: true
---

# 写入器、读取器与批量操作

可以将本指南视为 [创建、读取、更新、删除](./CRUD.md) 的第二部分。

如前文所述，不能在任意位置修改 WatermelonDB 的数据库。所有更改都必须在 **写入器** 内完成。

定义写入器有两种方式：内联方式和定义 **写入器方法**。

### 内联写入器

以下是一个内联写入器的示例，你可以在任何能访问 `database` 对象的地方调用它：

```js
// 注意：传递给 `database.write()` 的函数必须是异步的
const newPost = await database.write(async => {
  const post = await database.get('posts').create(post => {
    post.title = '新文章'
    post.body = 'Lorem ipsum...'
  })
  const comment = await database.get('comments').create(comment => {
    comment.post.set(post)
    comment.author.id = someUserId
    comment.body = '很棒的文章！'
  })

  // 注意：包装函数返回的值将返回给 `database.write` 的调用者
  return post
})
```

### 写入器方法

可以使用 `@writer` 装饰器在 `Model` 子类上定义写入器方法：

```js
import { writer } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...

  @writer async addComment(body, author) {
    const newComment = await this.collections.get('comments').create(comment => {
      comment.post.set(this)
      comment.author.set(author)
      comment.body = body
    })
    return newComment
  }
}
```

我们强烈建议在 `Models` 上定义写入器方法，以便将所有更改数据库的代码集中在一处，仅偶尔使用内联写入器。

请注意，这与定义一个简单的方法并将所有工作包装在 `database.write()` 中是一样的，使用 `@writer` 只是更方便。

**注意**：

- 始终将操作标记为 `async`，并记得在 `.create()` 和 `.update()` 上使用 `await`。
- 可以使用 `this.collections` 来访问 `Database.collections`。

**另一个示例**：`Comment` 上的更新操作：

```js
class Comment extends Model {
  // ...
  @field('is_spam') isSpam

  @writer async markAsSpam() {
    await this.update(comment => {
      comment.isSpam = true
    })
  }
}
```

现在我们可以创建一条评论并立即将其标记为垃圾评论：

```js
const comment = await post.addComment('Lorem ipsum', someUser)
await comment.markAsSpam()
```

## 批量更新

当在写入器中进行多次更改时，最好 **批量处理**。

批量处理意味着应用程序不必与数据库来回通信（发送一个命令，等待响应，然后再发送另一个命令），而是一次性发送多个命令。这样更快、更安全，并且可以避免应用程序中出现细微的错误。

以将 `Post` 更改为垃圾文章的操作为例：

```js
class Post extends Model {
  // ...
  @writer async createSpam() {
    await this.update(post => {
      post.title = `7 种减肥方法`
    })
    await this.collections.get('comments').create(comment => {
      comment.post.set(this)
      comment.body = "别忘了评论、点赞和订阅！"
    })
  }
}
```

让我们修改它以使用批量处理：

```js
class Post extends Model {
  // ...
  @writer async createSpam() {
    await this.batch(
      this.prepareUpdate(post => {
        post.title = `7 种减肥方法`
      }),
      this.collections.get('comments').prepareCreate(comment => {
        comment.post.set(this)
        comment.body = "别忘了评论、点赞和订阅！"
      })
    )
  }
}
```

**注意**：

- 只能在 `@writer` 方法中调用 `await this.batch`。也可以在 `database.write()` 块中调用 `database.batch()`。
- 将 **准备好的操作** 列表作为参数传递：
  - 不要调用 `await record.update()`，而是传递 `record.prepareUpdate()` — 注意不要使用 `await`。
  - 不要使用 `await collection.create()`，而是使用 `collection.prepareCreate()`。
  - 不要使用 `await record.markAsDeleted()`，而是使用 `record.prepareMarkAsDeleted()`。
  - 不要使用 `await record.destroyPermanently()`，而是使用 `record.prepareDestroyPermanently()`。
  - 高级用法：可以传递 `collection.prepareCreateFromDirtyRaw({ 在此处放入你的 JSON })`。
  - 可以将假值（null、undefined、false）传递给批量操作 — 它们将被简单地忽略。
  - 也可以传递一个单个数组参数，而不是参数列表。

## 删除操作

当删除，例如，一篇 `Post` 时，通常希望与之关联的所有 `Comment` 也被删除。

要做到这一点，可以重写 `markAsDeleted()`（如果你不进行同步，也可以重写 `destroyPermanently()`）以明确删除所有子项。

```js
class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @children('comments') comments

  async markAsDeleted() {
    await this.comments.destroyAllPermanently()
    await super.markAsDeleted()
  }
}
```

然后实际删除文章：

```js
database.write(async () => {
  await post.markAsDeleted()
})
```

**注意**：

- 对所有要删除的依赖 `@children` 使用 `Query.destroyAllPermanently()`。
- 记得在方法的末尾调用 `super.markAsDeleted`！

## 高级：为什么需要读取器（Readers）和写入器（Writers）？

WatermelonDB 是高度异步的，这在实现数据一致性方面是一个巨大的挑战。只有在你好奇的情况下才阅读以下内容：

<details>
  <summary>为什么需要读取器（Readers）和写入器（Writers）？</summary>

  假设有一个名为 `markCommentsAsSpam` 的函数，它会获取一篇文章的评论列表，然后将这些评论全部标记为垃圾评论。这两个操作（获取评论和更新评论状态）是异步的，在这两个操作之间可能会有其他修改数据库的操作执行。比如，可能恰好有一个函数在这个时候为这篇文章添加了一条新评论。这样一来，即使 `markCommentsAsSpam` 函数 *成功执行完毕*，但实际上它并没有完成将所有评论标记为垃圾评论的任务。

  这个例子看似简单，但其他情况可能会更加危险。如果一个函数获取一条记录来进行更新操作，在操作过程中这条记录可能会被删除，从而导致操作失败（如果处理不当，甚至可能导致应用崩溃）。或者，一个函数可能有一些条件来判断用户是否被允许执行某个操作，但在操作执行过程中这些条件可能会失效。又或者，在一个协作式应用中，访问权限由另一个对象表示，不同操作的并行执行可能会导致这些访问关系处于不一致的状态。

  最糟糕的是，要分析所有 *可能的* 交互是否存在危险非常困难，而且自动同步功能会让这些危险情况更容易发生。

  解决方案是什么呢？将相关的读取和写入操作组合在一个写入器中，强制要求所有写入操作都必须在写入器中进行，并且同一时间只允许一个写入器运行。这样就能保证在一个写入器中，你看到的是数据库的一个一致状态。大多数简单的读取操作可以不进行分组，但如果你有多个相关的读取操作，也需要将它们封装在一个读取器中。
</details>

## 高级：读取器（Readers）

读取器（Readers）是一个你很少会用到的高级功能。

由于 WatermelonDB 是异步的，如果你进行多个独立的查询操作，通常无法保证在查询之间不会有记录被创建、更新或删除。

然而，在读取器内部的代码可以保证，在读取器执行期间，数据库不会发生任何更改（更准确地说，在读取器工作期间，不会有写入器执行）。

例如，如果你要为应用编写一个自定义的 XML 数据导出功能，你会希望导出的信息是完全一致的。因此，你需要将所有查询操作封装在一个读取器中：

```js
database.read(async () => {
  // 在这个函数执行完毕之前，数据库不会发生任何更改
})

// 或者：
class Blog extends Model {
  // ...

  @reader async exportBlog() {
    const posts = await this.posts.fetch()
    const comments = await this.allComments.fetch()
    // ...
  }
}
```

## 高级：嵌套写入器（Writers）或读取器（Readers）

如果你尝试在一个写入器中调用另一个写入器，你会发现这样做行不通。这是因为在一个写入器运行时，其他写入器不能同时运行。要覆盖这个行为，可以将写入器调用封装在 `this.callWriter` 中：

```js
class Comment extends Model {
  // ...

  @writer async appendToPost() {
    const post = await this.post.fetch()
    // `appendToBody` 是 `Post` 上的一个 `@writer`，所以我们使用 callWriter 来允许调用它
    await this.callWriter(() => post.appendToBody(this.body))
  }
}

// 或者：
database.write(async writer => {
  const post = await database.get('posts').find('abcdef')
  await writer.callWriter(() => post.appendToBody('Lorem ipsum...')) // appendToBody 是一个 @writer
})
```

读取器也是同样的道理 - 使用 `callReader` 来嵌套读取器。

* * *

## 下一步

➡️ 现在你已经掌握了 WatermelonDB 的所有基础知识，可以去创建一些强大的应用了 — 或者继续阅读 [**高级指南**](./README.md)
