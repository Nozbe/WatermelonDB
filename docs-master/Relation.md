# Relations

A `Relation` object represents one record pointing to another — such as the author (`User`) of a `Comment`, or the `Post` the comment belongs to.

### Defining Relations

There's two steps to defining a relation:

1. A [**table column**](./Schema.md) for the related record's ID

   ```js
   tableSchema({
     name: 'comments',
     columns: [
       // ...
       { name: 'author_id', type: 'string' },
     ]
   }),
   ```
2. A `@relation` field [defined on a `Model`](./Model.md) class:

   ```js
   import { relation } from '@nozbe/watermelondb/decorators'

   class Comment extends Model {
     // ...
     @relation('users', 'author_id') author
   }
   ```

   The first argument is the _table name_ of the related record, and the second is the _column name_ with an ID for the related record.

### immutableRelation

If you have a relation that cannot change (for example, a comment can't change its author), use `@immutableRelation` for extra protection and performance:

```js
import { immutableRelation } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @immutableRelation('posts', 'post_id') post
  @immutableRelation('users', 'author_id') author
}
```

## Relation API

In the example above, `comment.author` returns a `Relation` object.

> Remember, WatermelonDB is a lazily-loaded database, so you don't get the related `User` record immediately, only when you explicitly fetch it

### Observing

Most of the time, you [connect Relations to Components](./Components.md) by using `observe()` (the same [as with Queries](./Query.md)):

```js
withObservables(['comment'], ({ comment }) => ({
  comment,
  author: comment.author, // shortcut syntax for `author: comment.author.observe()`
}))
```

The component will now have an `author` prop containing a `User`, and will re-render both when the user changes (e.g. comment's author changes its name), but also when a new author is assigned to the comment (if that was possible).

### Fetching

To simply get the related record, use `fetch`. You might need it [in a Writer](./Writers.md)

```js
const author = await comment.author.fetch()

// Shortcut syntax:
const author = await comment.author
```

**Note**: If the relation column (in this example, `author_id`) is marked as `isOptional: true`, `fetch()` might return `null`.

### ID

If you only need the ID of a related record (e.g. to use in an URL or for the `key=` React prop), use `id`.

```js
const authorId = comment.author.id
```

### Assigning

Use `set()` to assign a new record to the relation

```js
await database.get('comments').create(comment => {
  comment.author.set(someUser)
  // ...
})
```

**Note**: you can only do this in the `.create()` or `.update()` block.

You can also use `set id` if you only have the ID for the record to assign

```js
await comment.update(() => {
  comment.author.id = userId
})
```

## Advanced relations

### Many-To-Many Relation

If for instance, our app `Post`s can be authored by many `User`s and a user can author many `Post`s. We would create such a relation following these steps:-

1. Create a pivot schema and model that both the `User` model and `Post` model has association to; say `PostAuthor`
2. Create has_many association on both `User` and `Post` pointing to `PostAuthor` Model
3. Create belongs_to association on `PostAuthor` pointing to both `User` and `Post`
4. Retrieve all `Posts` for a user by defining a query that uses the pivot `PostAuthor` to infer the `Post`s that were authored by the User.

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
import { field } from '@nozbe/watermelondb/decorators'

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

## Next steps

➡️ Now the last step of this guide: [**understand Writers (and Readers)**](./Writers.md)
