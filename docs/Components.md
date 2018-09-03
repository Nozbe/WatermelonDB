# Connecting to Components

After you [define some Models](./Model.md), it's time to connect Watermelon to your app's interface. We're using React in this guide.

### Install `withObservables`

The recommended way to use Watermelon with React is with `withObservables` HOC (higher-order component). It doesn't come pre-packaged with Watermelon, but you can install it with:

```bash
yarn add @nozbe/with-observables
```

**Note:** If you're not familiar with higher-order components, read [React documentation](https://reactjs.org/docs/higher-order-components.html), check out [`recompose`](https://github.com/acdlite/recompose)… or just read the examples below to see it in practice!

## Reactive components

Here's a very simple React component rendering a `Comment` record:

```jsx
const Comment = ({ comment }) => (
  <div>
    <p>{comment.body}</p>
  </div>
)
```

Now we can fetch a comment: `const comment = await commentsCollection.find(id)` and then render it: `<Comment comment={comment} />`. The only problem is that this is **not reactive**. If the Comment is updated or deleted, the component will not re-render to reflect the changes. (Unless an update is forced manually or the parent component re-renders).

Let's enhance the component to make it _observe_ the `Comment` automatically:

```jsx
const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe()
}))
const EnhancedComment = enhance(Comment)
```

Now, if we render `<EnhancedComment comment={comment} />`, it **will** update every time the comment changes.

### Reactive lists

Let's render the whole `Post` with comments:

```jsx
const Post = ({ post, comments }) => (
  <article>
    <h1>{post.name}</h1>
    <p>{post.body}</p>
    <h2>Comments</h2>
    {comments.map(comment =>
      <EnhancedComment key={comment.id} comment={comment} />
    )}
  </article>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  comments: post.comments.observe()
}))

const EnhancedPost = enhance(Post)
```

Notice a couple of things:

1. We're starting with a simple non-reactive `Post` component
2. Like before, we enhance it by observing the `Post`. If the post name or body changes, it will re-render.
3. To access comments, we fetch them from the database and observe using `post.comments.observe()` and inject a new prop `comments`. (`post.comments` is a Query created using `@children`).
4. By **observing the Query**, the `<Post>` component will re-render if a comment is created or deleted
5. However, observing the comments Query will not re-render `<Post>` if a comment is _updated_ — we render the `<EnhancedComment>` so that _it_ observes the comment and re-renders if necessary.

### Reactive relations

The `<Comment>` component we made previously only renders the body of the comment but doesn't say who posted it.

Assume the `Comment` model has a `@relation('users', 'author_id') author` field. Let's render it:

```jsx
const Comment = ({ comment, author }) => (
  <div>
    <p>{comment.body} — by {author.name}</p>
  </div>
)

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe(),
  author: comment.author.observe(),
}))
const EnhancedComment = enhance(Comment)
```

`comment.author` is a [Relation object](./Relation.md), and we can call `.observe()` on it to fetch the `User` and then observe changes to it. If author's name changes, the component will re-render.

### Reactive counters

Let's make a `<PostExcerpt>` component to display on a *list* of Posts, with only a brief summary of the contents and only the number of comments it has:

```jsx
const PostExcerpt = ({ post, commentCount }) => (
  <div>
    <h1>{post.name}</h1>
    <p>{getExcerpt(post.body)}</p>
    <span>{commentCount} comments</span>
  </div>
)

const enhance = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount()
}))

const EnhancedPostExcerpt = enhance(PostExcerpt)
```

This is very similar to normal `<Post>`. We take the `Query` for post's comments, but instead of observing the _list_ of comments, we call `observeCount()`. This is far more efficient. And as always, if a new comment is posted, or one is deleted, the component will re-render with the updated count.

## Understanding `withObservables`

Let's unpack this:

```js
withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount()
}))
```

1. Starting from the second argument, `({ post })` are the input props for the component. Here, we receive `post` prop with a `Post` object.
2. These:
    ```js
    ({
      post: post.observe(),
      commentCount: post.comments.observeCount()
    })
    ```
    are the enhanced props we inject. The keys are props' names, and values are `Observable` objects. Here, we override the `post` prop with an observable version, and create a new `commentCount` prop.
3. The first argument: `['post']` is a list of props that trigger observation restart. So if a different `post` is passed, that new post will be observed. If you pass `[]`, the rendered Post will not change. You can pass multiple prop names if any of them should cause observation to re-start.
4. **Rule of thumb**: If you want to use a prop in the second arg function, pass its name in the first arg array

## Advanced

1. **findAndObserve**. If you have, say, a post ID from your Router (URL in the browser), you can use:
   ```js
   withObservables(['postId'], ({ postId, database }) => ({
     post: database.collections.get('posts').findAndObserve(postId)
   }))
   ```
1. **RxJS transformations**. The values returned by `Model.observe()`, `Query.observe()`, `Relation.observe()` are [RxJS Observables](https://github.com/ReactiveX/rxjs). You can use standard transforms like mapping, filtering, throttling, startWith to change when and how the component is re-rendered.
1. **Custom Observables**. `withObservables` is a general-purpose HOC for Observables, not just Watermelon. You can create new props from any `Observable`.

### Advanced: observing sorted lists

If you have a list that's dynamically sorted (e.g. sort comments by number of likes), use `Query.observeWithColumns` to ensure the list is re-rendered when its order changes:

```jsx
// This is a function that sorts an array of comments according to its `likes` field
// I'm using `ramda` functions for this example, but you can do sorting however you like
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

If you inject `post.comments.observe()` into the component, the list will not re-render to change its order, only if comments are added or removed. Instead, use `query.observeWithColumns()` with an array of [**column names**](./Schema.md) you use for sorting to re-render whenever a record on the list has any of those fields changed.

* * *

## Next steps

➡️ Next, learn more about [**custom Queries**](./Query.md)
