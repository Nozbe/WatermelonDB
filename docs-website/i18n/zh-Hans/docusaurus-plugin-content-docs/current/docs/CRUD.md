# 创建、读取、更新、删除

当你定义好 [Schema（模式）](./Schema.md) 和 [Models（模型）](./Model.md) 之后，就可以学习如何对它们进行操作了！

## 读取数据

### 获取集合

`Collection`（集合）对象用于查找、查询和创建给定类型的新记录。

```js
const postsCollection = database.get('posts')
```

将 [表名](./Schema.md) 作为参数传入。

### 查找单条记录（通过 ID）

```js
const postId = 'abcdefgh'
const post = await database.get('posts').find(postId)
```

`find()` 方法返回一个 Promise 对象。如果未找到记录，该 Promise 将被拒绝。

### 查询记录

通过创建一个查询对象，然后获取查询结果，来查找符合给定条件的记录列表：

```js
const allPosts = await database.get('posts').query().fetch()
const numberOfStarredPosts = await database.get('posts').query(
  Q.where('is_starred', true)
).fetchCount()
```

**➡️ 了解更多：** [Queries（查询）](./Query.md)

## 修改数据库

对数据库的所有修改操作（如创建、更新、删除记录）都必须在 **写入器（Writer）** 中完成，可以通过将操作代码包裹在 `database.write()` 中实现：

```js
await database.write(async () => {
  const someComment = await database.get('comments').find(commentId)
  await someComment.update((comment) => {
    comment.isSpam = true
  })
})
```

或者在模型中定义一个 `@writer` 方法：

```js
import { writer } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // (...)
  @writer async markAsSpam() {
    await this.update(comment => {
      comment.isSpam = true
    })
  }
}
```

**➡️ 了解更多：** [Writers（写入器）](./Writers.md)

### 创建新记录

```js
const newPost = await database.get('posts').create(post => {
  post.title = 'New post'
  post.body = 'Lorem ipsum...'
})
```

`.create()` 方法接受一个“构建函数”。在上述示例中，构建函数将接收一个 `Post` 对象作为参数。使用该对象为 [你定义的字段](./Model.md) 设置值。

**注意：** 在访问创建的记录之前，务必使用 `await` 等待 `create` 方法返回的 Promise 对象。

**注意：** 只能在 `create()` 或 `update()` 构建函数内部设置字段值。

### 更新记录

```js
await somePost.update(post => {
  post.title = 'Updated title'
})
```

和创建记录一样，更新记录也需要一个构建函数，你可以在其中使用字段设置器。

**注意：** 在访问修改后的记录之前，一定要使用 `await` 等待 `update` 返回的 Promise 对象。

### 删除记录

删除记录有两种方式：可同步删除（标记为已删除）和永久删除。

如果你仅将 Watermelon 用作本地数据库，可以永久销毁记录；如果你要进行 [数据同步](./Sync/Intro.md)，则应标记为已删除。

```js
await somePost.markAsDeleted() // 可同步删除
await somePost.destroyPermanently() // 永久删除
```

**注意：** 记录删除后，不要访问、更新或观察它们。

## 高级用法

- `Model.observe()` - 通常你只会在 [将记录连接到组件时](./Components.md) 使用此方法，但你也可以在 React 组件之外手动观察记录。返回的 [RxJS](https://github.com/reactivex/rxjs) `Observable` 对象会在订阅时立即发出记录，并且在每次记录更新时再次发出。如果记录被删除，该 Observable 会完成。
- `Query.observe()`、`Relation.observe()` — 与上述方法类似，但用于 [查询](./Query.md) 和 [关联关系](./Relation.md)。
- `Query.observeWithColumns()` - 用于 [排序列表](./Components.md)。
- `Collection.findAndObserve(id)` — 等同于先使用 `.find(id)` 然后调用 `record.observe()`。
- `Model.prepareUpdate()`、`Collection.prepareCreate`、`Database.batch` — 用于 [批量更新](./Writers.md)。
- `Database.unsafeResetDatabase()` 会销毁整个数据库 - [在使用前请务必查看此注释](https://github.com/Nozbe/WatermelonDB/blob/22188ee5b6e3af08e48e8af52d14e0d90db72925/src/Database/index.js#L131)。
- 若要在创建记录时覆盖 `record.id`，例如与远程数据库同步，可以通过 `record._raw` 属性来实现。请注意，`id` 必须为 `string` 类型。
    ```js
    await database.get('posts').create(post => {
      post._raw.id = serverId
    })
    ```

### 高级用法：不安全的原生执行

⚠️ 如果你不清楚自己在做什么，请不要使用此功能...

有一个方法可以从 WatermelonDB 降至底层数据库级别来执行任意命令。仅在万不得已时使用：

```js
await database.write(() => {
  // sqlite:
  await database.adapter.unsafeExecute({
    sqls: [
      // [sql_query, [其他参数, ...]]
      ['create table temporary_test (id, foo, bar)', []],
      ['insert into temporary_test (id, foo, bar) values (?, ?, ?)', ['t1', true, 3.14]],
    ]
  })

  // lokijs:
  await database.adapter.unsafeExecute({
    loki: loki => {
      loki.addCollection('temporary_test', { unique: ['id'], indices: [], disableMeta: true })
      loki.getCollection('temporary_test').insert({ id: 't1', foo: true, bar: 3.14 })
    }
  })
})
```

* * *

## 下一步

➡️ 现在你已经可以创建和更新记录了，接下来可以 [**将它们连接到 React 组件**](./Components.md)。

