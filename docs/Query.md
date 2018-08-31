# Query API

**Querying** is how you find records that match certain conditions, for example:

- Find all comments that belong to a certain post
- Find all _verified_ comments made by John
- Count all verified comments made by John or Lucy published under posts made in the last two weeks

Because queries are executed on the database, and not in JavaScript, they're really fast. It's also how Watermelon can be fast even at large scales, because even with tens of thousands of records _total_, you rarely need to load more than a few dozen records at app launch.

## Defining Queries

### @children

The simplest query is made using `@children`. This defines a `Query` for all comments that belong to a `Post`:

```js
class Post extends Model {
  // ...
  @children('comments') comments
}
```

**➡️ Learn more:** [Defining Models](./Model.md)

### Extended Query

To **narrow down** a `Query` (add [extra conditions](#query-conditions) to an existing Query), use `.extend()`:

```js
import { children, lazy } from 'watermelondb/decorators'

class Post extends Model {
  // ...
  @children('comments') comments
  @lazy verifiedComments = this.comments.extend(Q.where('is_verified', true))
  @lazy verifiedAwesomeComments = this.verifiedComments.extend(Q.where('is_awesome', true))
}
```

**Note:** Use the `@lazy` when extending or defining new Queries for performance

### Custom Queries

You can query any table using `this.collections.get(tableName).query(conditions)`. Here, `post.comments` will query all users that made a comment under `post`.

```js
class Post extends Model {
  // ...
  @lazy commenters = this.collections.get('users').query(
    Q.on('comments', 'post_id', this.id)
  )
}
```

## Executing Queries

Most of the time, you [connect Queries to Components](./Components.md) by using `observe` or `observeCount`:

```js
withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  comments: post.comments.observe(),
  verifiedCommentCount: post.verifiedComments.observeCount(),
}))
```

#### Fetch

To simply get the current list or current count, use `fetch` / `fetchCount`. You might need it [in Actions](./Actions.md).

```js
const comments = await post.comments.fetch()
const verifiedCommentCount = await post.verifiedComments.fetchCount()
```

## Query conditions

```js
import { Q } from 'watermelondb'
// ...
commentCollection.query(
  Q.where('is_verified', true)
)
```

This will query **all** comments that are verified (all comments with one condition: the `is_verified` column of a comment must be `true`).

When making conditions, you refer to [**column names**](./Schema.md) of a table (i.e. `is_verified`, not `isVerified`). This is because queries are executed directly on the underlying database.

The second argument is the value we want to query for. Note that the passed argument must be the same type as the column (`string`, `number`, or `boolean`; `null` is allowed only if the column is marked as `isOptional: true` in the schema).

#### Empty query

```js
const allComments = await commentCollection.query().fetch()
```

A Query with no conditions will find **all** records in the collection.

**Note:** Don't do this unless necessary. It's generally more efficient to only query the exact records you need.

#### Multiple conditions

```js
commentCollection.query(
  Q.where('is_verified', true),
  Q.where('is_awesome', true)
)
```

This queries all comments that are **both** verified **and** awesome.

### Conditions with other operators

| Query | JavaScript equivalent |
| ------------- | ------------- |
| `Q.where('is_verified', true)` | `is_verified === true` (shortcut syntax) |
| `Q.where('is_verified', Q.eq(true))` | `is_verified === true` |
| `Q.where('archived_at', Q.notEq(null))` | `archived_at !== null` |
| `Q.where('likes', Q.gt(0))` | `likes > 0`  |
| `Q.where('likes', Q.weakGt(0))` | `likes > 0` (slightly different semantics — [see "null behavior"](#null-behavior) for details) |
| `Q.where('likes', Q.gte(100))` | `likes >= 100` |
| `Q.where('dislikes', Q.lt(100))` | `dislikes < 100` |
| `Q.where('dislikes', Q.lte(100))` | `dislikes <= 100` |
| `Q.where('likes', Q.between(10, 100))` | `likes >= 10 && likes <= 100` |
| `Q.where('status', Q.oneOf('published', 'draft'))` | `status === 'published' \|\| status === 'draft'` |
| `Q.where('status', Q.notIn('archived', 'deleted'))` | `status !== 'archived' && status !== 'deleted'` |

### Conditions on related tables

For example: query all comments under posts published by John:

```js
commentCollection.query(
  Q.on('posts', 'author_id', john.id),
)
```

Normally you set conditions on the table you're querying. Here we're querying **comments**, but we have a condition on the **post** the comment belongs to.

The first argument for `Q.on` is the table name you're making a condition on. The other two arguments are same as for `Q.where`.

**Note:** The two tables [must be associated](./Model.md) before you can use `Q.on`.

## Advanced Queries

### Advanced observing

Call `query.observeWithFields(['foo', 'bar'])` to create an Observable that emits a value not only when the list of matching records changes (new records/deleted records), but also when any of the matched records changes its `foo` or `bar` column. [Use this for observing sorted lists](./Components.md)

#### Count throttling

By default, calling `query.observeCount()` returns an Observable that is throttled to emit at most once every 250ms. You can disable throttling using `query.observeCount(false)`.

### AND/OR nesting

You can nest multiple conditions using `Q.and` and `Q.or`:

```js
commentCollection.query(
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

This is equivalent to `archivedAt !== null && (isVerified || (likes > 10 && dislikes < 5))`.

### Column comparisons

This queries comments that have more likes than dislikes. Note that we're comparing `likes` column to another column instead of a value.

```js
commentCollection.query(
  Q.where('likes', Q.gt(Q.column('dislikes')))
)
```

### `null` behavior

There are some gotchas you should be aware of. The `Q.gt`, `gte`, `lt`, `lte`, `oneOf`, `notIn` operators match the semantics of SQLite in terms of how they treat `null`. Those are different from JavaScript.

**Rule of thumb:** No null comparisons are allowed.

For example, if you query `comments` for `Q.where('likes', Q.lt(10))`, a comment with 8 likes and 0 likes will be included, but a comment with `null` likes will not! In Watermelon queries, `null` is not less than any number. That's why you should avoid [making table columns optional](./Schema.md) unless you actually need it.

Similarly, if you query with a column comparison, like `Q.where('likes', Q.gt(Q.column('dislikes')))`, only comments where both `likes` and `dislikes` are not null will be compared. A comment with 5 likes and `null` dislikes will NOT be included. 5 is not greater than `null` here.

**`Q.oneOf` operator**: It is not allowed to pass `null` as an argument to `Q.oneOf`. Instead of `Q.oneOf([null, 'published', 'draft'])` you need to explicitly allow `null` as a value like so:

```js
postsCollection.query(
  Q.or(
    Q.where('status', Q.oneOf(['published', 'draft'])),
    Q.where('status', null)
  )
)
```

**`Q.notIn` operator**: If you query, say, posts with `Q.where('status', Q.notIn(['published', 'draft']))`, it will match posts with a status different than `published` or `draft`, however, it will NOT match posts with `status == null`. If you want to include such posts, query for that explicitly like with the example above.

**`Q.weakGt` operator**: This is weakly typed version of `Q.gt` — one that allows null comparisons. So if you query `comments` with `Q.where('likes', Q.weakGt(Q.column('dislikes')))`, it WILL match comments with 5 likes and `null` dislikes. (For `weakGt`, unlike standard operators, any number is greater than `null`).
