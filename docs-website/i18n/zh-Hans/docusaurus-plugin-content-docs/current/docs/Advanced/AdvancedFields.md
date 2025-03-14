# 高级字段

## `@json`

如果您有大量关于某条记录的元数据（例如，一个包含多个键的对象，或者一个值数组），您可以使用 `@json` 字段将这些信息存储在一个字符串列中（序列化为 JSON 格式），而不是添加多个列或建立与另一个表的关联。

⚠️ 这是一个高级功能，存在一些缺点 —— 请确保您确实需要使用它。

首先，在 [模式文件](../Schema.md) 中添加一个字符串列：

```js
tableSchema({
  name: 'comments',
  columns: [
    { name: 'reactions', type: 'string' }, // 如果合适，您可以添加 isOptional: true
  ],
})
```

然后在模型定义中：

```js
import { json } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @json('reactions', sanitizeReactions) reactions
}
```

现在，您可以为字段设置复杂的 JSON 值：

```js
comment.update(() => {
  comment.reactions = ['up', 'down', 'down']
})
```

作为第二个参数，请传递一个 **清理函数**。这是一个接收 `JSON.parse()` 对序列化 JSON 解析后返回的任何内容，并返回您的应用程序期望的类型的函数。换句话说，它将原始、杂乱、不可信的数据（可能缺失，或者由于应用程序的先前版本中的错误而格式错误）转换为可信的格式。

如果该列可为空，清理函数可能会接收到 `null`；如果该字段不包含有效的 JSON，则可能会接收到 `undefined`。

例如，如果您需要该字段为字符串数组，您可以这样确保：

```js
const sanitizeReactions = rawReactions => {
  return Array.isArray(rawReactions) ? rawReactions.map(String) : []
}
```

如果您不想对 JSON 进行清理，可以传递一个恒等函数：

```js
const sanitizeReactions = json => json
```

清理函数可以接受一个可选的第二个参数，它是对模型的引用。如果您的清理逻辑依赖于模型中的其他字段，这将非常有用。

**关于 JSON 字段的警告**：

JSON 字段违背了 Watermelon 的关系型和惰性特性，因为 **您无法根据 JSON 字段的内容进行查询或计数**。如果您现在或将来需要根据某些数据查询记录，请不要使用 JSON。

仅在您需要复杂自由格式数据的灵活性，或者在不查询另一个表的情况下获取元数据的速度，并且确定不需要根据这些元数据进行查询时，才使用 JSON 字段。

## `@nochange`

为了提供额外的保护，你可以将字段标记为 `@nochange`，以确保它们不能被修改。请始终将 `@nochange` 放在 `@field` / `@date` / `@text` 之前。

```js
import { field, nochange } from '@nozbe/watermelondb/decorators'

class User extends Model {
  // ...
  @nochange @field('is_owner') isOwner
}
```

`user.isOwner` 只能在 `collection.create()` 块中设置，如果尝试在 `user.update()` 块中设置新值，将会抛出错误。

### `@readonly`

与 `@nochange` 类似，你可以使用 `@readonly` 装饰器来确保一个字段根本不能被设置。这适用于 [创建/更新跟踪](./CreateUpdateTracking.md)，如果您将 Watermelon 与 [同步引擎](../Sync/Intro.md) 一起使用，并且某个字段只能由服务器设置，那么这个装饰器也会很有用。

## 自定义可观察字段

现在你已经进入了高级 [RxJS](https://github.com/ReactiveX/rxjs) 领域！请谨慎操作。

假设你有一个 `Post` 模型，它关联多个 `Comment` 模型。如果一篇 `Post` 有超过 10 条评论，那么它就被认为是“热门”的。

你可以通过两种方式为 `Post` 组件添加“热门”徽章。

一种是在 [组件中](../Components.md) 简单地观察评论的数量：

```js
const enhance = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount()
}))
```

然后在 `render` 方法中，如果 `props.commentCount > 10`，就显示徽章。

另一种方法是在模型层定义一个可观察属性，如下所示：

```js
import { distinctUntilChanged, map as map$ } from 'rxjs/operators'
import { lazy } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  @lazy isPopular = this.comments.observeCount().pipe(
    map$(comments => comments > 10),
    distinctUntilChanged()
  )
}
```

然后你可以直接将其连接到组件：

```js
const enhance = withObservables(['post'], ({ post }) => ({
  isPopular: post.isPopular,
}))
```

`props.isPopular` 将反映该文章是否热门。请注意，这是完全可观察的，即如果评论数量超过或低于热门阈值，组件将重新渲染。下面我们来详细分析一下：

- `this.comments.observeCount()` - 获取评论数量的可观察对象。
- `map$(comments => comments > 10)` - 将其转换为一个布尔值的可观察对象（是否热门）。
- `distinctUntilChanged()` - 这样做是为了确保当评论数量发生变化，但热门状态未改变（仍然低于/高于 10 条评论）时，组件不会不必要地重新渲染。
- `@lazy` - 同样是为了性能考虑（我们只定义一次这个可观察对象，这样就可以免费复用它）。

让我们把这个例子变得更复杂一些。假设如果文章被标记为“已收藏”，那么它 **始终** 是热门的。所以如果 `post.isStarred` 为 `true`，我们就不必进行不必要的获取评论数量的操作：

```js
import { of as of$ } from 'rxjs/observable/of'
import { distinctUntilChanged, map as map$ } from 'rxjs/operators'
import { lazy } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  @lazy isPopular = this.observe().pipe(
    distinctUntilKeyChanged('isStarred'),
    switchMap(post =>
      post.isStarred ?
        of$(true) :
        this.comments.observeCount().pipe(map$(comments => comments > 10))
    ),
    distinctUntilChanged(),
  )
}
```

- `this.observe()` - 如果文章发生变化，其热门状态可能会改变，所以我们对其进行观察。
- `this.comments.observeCount().pipe(map$(comments => comments > 10))` - 这部分和之前一样，但我们只在文章未被收藏时才进行观察。
- `switchMap(post => post.isStarred ? of$(true) : ...)` - 如果文章被收藏，我们直接返回一个始终发出 `true` 且不会改变的可观察对象。
- `distinctUntilKeyChanged('isStarred')` - 出于性能考虑，这样当文章发生变化时（只有当 `isStarred` 字段改变时），我们才会重新订阅评论数量的可观察对象。
- `distinctUntilChanged()` - 同样，如果热门状态没有改变，就不发出（emit）新的值。
