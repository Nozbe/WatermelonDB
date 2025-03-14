---
title: 连接组件
---

在你[定义了一些模型](./Model.md)之后，就该将 Watermelon 连接到你的应用界面了。本指南中我们使用的是 React，不过 WatermelonDB 可以与任何 UI 框架配合使用。

**注意：** 如果你对高阶组件不太熟悉，可以阅读 [React 文档](https://reactjs.org/docs/higher-order-components.html)，查看 [`recompose`](https://github.com/acdlite/recompose)……或者直接阅读下面的示例，在实践中了解它！

### 响应式组件

以下是一个非常简单的 React 组件，用于渲染一条 `Comment` 记录：

```jsx
const Comment = ({ comment }) => (
  <div>
    <p>{comment.body}</p>
  </div>
)
```

现在我们可以获取一条评论：`const comment = await commentsCollection.find(id)`，然后渲染它：`<Comment comment={comment} />`。唯一的问题是，这**不是响应式的**。如果评论被更新或删除，组件不会重新渲染以反映这些更改。（除非手动强制更新或父组件重新渲染）。

让我们增强这个组件，使其自动“观察” `Comment`：

```jsx
import { withObservables } from '@nozbe/watermelondb/react'

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment // `comment: comment.observe()` 的快捷语法
}))
const EnhancedComment = enhance(Comment)
export default EnhancedComment
```

现在，如果我们渲染 `<EnhancedComment comment={comment} />`，每当评论发生变化时，它**都会**更新。

### 响应式列表

让我们渲染包含评论的完整 `Post`：

```jsx
import { withObservables } from '@nozbe/watermelondb/react'
import EnhancedComment from 'components/Comment'

const Post = ({ post, comments }) => (
  <article>
    <h1>{post.name}</h1>
    <p>{post.body}</p>
    <h2>评论</h2>
    {comments.map(comment =>
      <EnhancedComment key={comment.id} comment={comment} />
    )}
  </article>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post,
  comments: post.comments, // `post.comments.observe()` 的快捷语法
}))

const EnhancedPost = enhance(Post)
export default EnhancedPost
```

注意以下几点：

1. 我们从一个简单的非响应式 `Post` 组件开始。
2. 和之前一样，我们通过观察 `Post` 来增强这个组件。如果文章的标题或内容发生变化，组件将重新渲染。
3. 为了获取评论，我们从数据库中获取它们，并使用 `post.comments.observe()` 进行观察，然后注入一个新的属性 `comments`。（`post.comments` 是使用 `@children` 创建的查询）。

   注意，为了方便起见，我们可以省略 `.observe()`，直接传递 `post.comments` —— `withObservables` 会帮我们调用 `observe`。
4. 通过**观察查询**，如果有评论被创建或删除，`<Post>` 组件将重新渲染。
5. 然而，观察评论查询不会在某条评论**更新**时重新渲染 `<Post>` —— 我们渲染 `<EnhancedComment>` 组件，以便它观察评论并在必要时重新渲染。

### 响应式关联关系

我们之前创建的 `<Comment>` 组件仅渲染评论内容，并未显示评论者是谁。

假设 `Comment` 模型有一个 `@relation('users', 'author_id') author` 字段。我们来渲染它：

```jsx
const Comment = ({ comment, author }) => (
  <div>
    <p>{comment.body} — 作者: {author.name}</p>
  </div>
)

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment,
  author: comment.author, // `comment.author.observe()` 的快捷语法
}))
const EnhancedComment = enhance(Comment)
```

`comment.author` 是一个 [关联对象](./Relation.md)，我们可以对其调用 `.observe()` 方法来获取 `User` 数据并观察其变化。如果作者的姓名发生更改，组件将重新渲染。

**再次注意**，为了方便起见，我们也可以直接传递 `关联` 对象，省略 `.observe()` 方法。

### 响应式可选关联关系

继续上面的示例，如果评论没有作者，`comment.author_id` 必定为 `null`。如果 `comment.author_id` 有值，它所引用的作者记录必须存储在数据库中，否则 `withObservables` 会抛出记录未找到的错误。


### 响应式计数器

让我们创建一个 `<PostExcerpt>` 组件，用于在文章列表中显示，仅展示文章内容的简要摘要以及评论数量：

```jsx
const PostExcerpt = ({ post, commentCount }) => (
  <div>
    <h1>{post.name}</h1>
    <p>{getExcerpt(post.body)}</p>
    <span>{commentCount} comments</span>
  </div>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post,
  commentCount: post.comments.observeCount()
}))

const EnhancedPostExcerpt = enhance(PostExcerpt)
```

这与普通的 `<Post>` 组件非常相似。我们获取文章评论的 `Query` 对象，但不是观察评论*列表*，而是调用 `observeCount()` 方法。这样做效率要高得多。和之前一样，如果有新评论发布或删除了一条评论，组件会重新渲染并显示更新后的评论数量。

## 那么 React Hooks 呢？

我们理解 —— 高阶组件（HOCs）已经是 2017 年的技术了，而 Hooks 才是未来的趋势！我们对此表示认同。

然而，Hooks 与 WatermelonDB 的异步 API 不兼容。你*可以*使用适用于 Rx Observables 的开源 Hooks 替代方案，但我们不建议这样做。它们在所有情况下都无法正常工作，并且在与 WatermelonDB 配合使用时，性能优化不如 `withObservables`。未来，一旦并发版 React 完全开发并发布，WatermelonDB 将提供官方的 Hooks。

**[查看关于官方 `useObservables` Hook 的讨论](https://github.com/Nozbe/withObservables/issues/16)**

## 了解 `withObservables`

让我们来详细解析一下：

```js
withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount()
}))
```

1. 从第二个参数开始，`({ post })` 是组件的输入属性。在这里，我们接收到一个包含 `Post` 对象的 `post` 属性。
2. 以下部分：
    ```js
    ({
      post: post.observe(),
      commentCount: post.comments.observeCount()
    })
    ```
    是我们注入的增强属性。键是属性名，值是 `Observable` 对象。在这里，我们用可观察版本的 `post` 属性覆盖了原有的 `post` 属性，并创建了一个新的 `commentCount` 属性。
3. 第一个参数：`['post']` 是一个会触发观察重新启动的属性列表。因此，如果传递了不同的 `post`，就会观察那个新的文章。如果你传递 `[]`，渲染的文章将不会改变。如果你希望多个属性中的任何一个导致观察重新启动，可以传递多个属性名。你可以把它想象成传递给 `useEffect` Hook 的 `deps` 参数。
4. **经验法则**：如果你想在第二个参数函数中使用某个属性，就把它的名称添加到第一个参数数组中。

## 高级用法

1. **findAndObserve**。假设你从路由（浏览器中的 URL）中获取了一个帖子 ID，你可以使用以下代码：
   ```js
   withObservables(['postId'], ({ postId, database }) => ({
     post: database.get('posts').findAndObserve(postId)
   }))
   ```
1. **RxJS 转换**。`Model.observe()`、`Query.observe()`、`Relation.observe()` 返回的值是 [RxJS 可观察对象](https://github.com/ReactiveX/rxjs)。你可以使用标准的转换操作，如映射、过滤、节流、startWith 来改变组件重新渲染的时机和方式。
1. **自定义可观察对象**。`withObservables` 是一个通用的高阶组件（HOC），用于处理可观察对象，不仅仅局限于 Watermelon。你可以从任何 `Observable` 创建新的属性。

### 高级用法：观察排序后的列表

如果你有一个动态排序的列表（例如，按点赞数对评论进行排序），可以使用 `Query.observeWithColumns` 来确保列表在排序顺序改变时重新渲染：

```jsx
// 这是一个根据 `likes` 字段对评论数组进行排序的函数
// 这个示例中我使用了 `ramda` 函数，但你可以使用任何你喜欢的排序方法
const sortComments = sortWith([
  descend(prop('likes'))
])

const CommentList = ({ comments }) => (
  <div>
    {sortComments(comments).map(comment =>
      <EnhancedComment key={comment.id} comment={comment} />
    )}
  </div>
)

const enhance = withObservables(['post'], ({ post }) => ({
  comments: post.comments.observeWithColumns(['likes'])
}))

const EnhancedCommentList = enhance(CommentList)
```

如果你将 `post.comments.observe()` 注入到组件中，列表只会在评论被添加或移除时重新渲染，而不会在排序顺序改变时重新渲染。相反，使用 `query.observeWithColumns()` 并传入一个用于排序的 [**列名**](./Schema.md) 数组，这样当列表中的任何记录的这些字段发生变化时，列表就会重新渲染。

### 高级用法：观察二级关联关系

如果你有二级关联关系，比如作者的 `Contact`（联系人）信息，并且想将其也连接到一个组件上，你不能简单地在 `withObservables` 中使用 `post.author.contact.observe()`。请记住，`post.author` 不是一个 `User` 对象，而是一个需要异步获取的 `Relation`（关联）对象。

在访问和观察 `Contact` 关联之前，你需要先解析 `author` 本身。以下是最简单的实现方法：

```js
import { compose } from '@nozbe/watermelondb/react'

const enhance = compose(
  withObservables(['post'], ({ post }) => ({
    post,
    author: post.author,
  })),
  withObservables(['author'], ({ author }) => ({
    contact: author.contact,
  })),
)

const EnhancedPost = enhance(PostComponent);
```

如果你不熟悉函数组合，可以从上到下阅读 `enhance` 函数：

- 首先，`PostComponent` 被增强，将传入的 `post` 属性转换为其可观察的版本，并添加一个新的 `author` 属性，该属性将包含 `post.author` 获取到的内容。
- 然后，增强后的组件再次被增强，添加一个 `contact` 属性，该属性包含 `author.contact` 获取到的内容。

#### 观察二级关联关系的替代方法

如果你熟悉 `rxjs`，另一种实现相同结果的方法是使用 `switchMap` 操作符：

```js
import { switchMap } from 'rxjs/operators'

const enhance = withObservables(['post'], ({post}) => ({
  post: post,
  author: post.author,
  contact: post.author.observe().pipe(switchMap(author => author.contact.observe()))
}))

const EnhancedPost = enhance(PostComponent)
```

现在，`PostComponent` 将拥有 `Post`、`Author` 和 `Contact` 属性。

#### 二级可选关联关系

如果 `Post` 和 `Author` 之间存在可选关联关系，增强后的组件可能会收到 `null` 作为 `author` 属性。由于你必须始终为 `contact` 属性返回一个可观察对象，你可以使用 `rxjs` 的 `of` 函数来创建一个默认或空的 `Contact` 属性：

```js
import { of as of$ } from 'rxjs'
import { withObservables, compose } from '@nozbe/watermelondb/react'

const enhance = compose(
  withObservables(['post'], ({ post }) => ({
    post,
    author: post.author,
  })),
  withObservables(['author'], ({ author }) => ({
    contact: author ? author.contact.observe() : of$(null),
  })),
)
```

使用 `switchMap` 方法，你可以这样做：

```js
const enhance = withObservables(['post'], ({post}) => ({
  post: post,
  author: post.author,
  contact: post.author.observe().pipe(
    switchMap(author => author ? author.contact : of$(null))
  )
}))
```

## 数据库提供者

为了避免属性层层传递（prop drilling），你可以使用数据库提供者（Database Provider）和 `withDatabase` 高阶组件。

```jsx
import { DatabaseProvider } from '@nozbe/watermelondb/react'

// ...

const database = new Database({
  adapter,
  modelClasses: [Blog, Post, Comment],
})

render(
  <DatabaseProvider database={database}>
    <Root />
  </DatabaseProvider>, document.getElementById('application')
)

```

要在组件中使用数据库，你只需像下面这样包装你的组件：

```jsx
import { withDatabase, compose } from '@nozbe/watermelondb/react'

// ...

export default compose(
  withDatabase,
  withObservables([], ({ database }) => ({
    blogs: database.get('blogs').query(),
  })),
)(BlogList)

```

`withObservables` 高阶组件中的 `database` 属性是由数据库提供者提供的。

### `useDatabase`

你也可以使用 React Hooks 语法来使用 `Database` 对象：

```js
import { useDatabase } from '@nozbe/watermelondb/react'

const Component = () => {
   const database = useDatabase()
}
```

* * *

## 下一步

➡️ 接下来，了解更多关于 [**自定义查询**](./Query.md) 的内容。
