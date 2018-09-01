# Relations

`Relation` objects represent one record point to another — such as the author (`User`) of a `Comment`, or the `Post` the comment belongs to.

### Defining Relations

There's two parts to defining a relation:

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
   import { relation } from 'watermelondb/decorators'
   
   class Comment extends Model {
     // ...
     @relation('users', 'author_id') author
   }
   ```
   
   The first argument is the _table name_ of the related record, and the second is the _column name_ with an ID for the related record.

## Relation API

In the example above, `comment.author` returns a `Relation` object.

> Remember, WatermelonDB is a lazily-loaded database, so you don't get the related record (here, a `User`) unless you specifically request to fetch it

### Observing

Most of the time, you [connect Relations to Components](./Components.md) by using `observe()` (the same [as with Queries](./Query.md)):

```js
withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe(),
  author: comment.author.observe(),
}))
```

The component will now have an `author` prop containing a `User`, and will re-render both when the user changes (e.g. comment's author changes its name), but also when a new author is assigned to the comment (if that was possible).

### Fetching

To simply get the related record, use `fetch`. You might need it [in Actions](./Actions.md)

```js
const author = await comment.author.fetch()
```

### ID

If you only need the ID of a related record (e.g. to use in an URL or for the `key=` React prop), use `id`.

```js
const authorId = comment.author.id
```

### Updating the relation

If you want to set a different record for a relation, use `set()`

```js
await someComment.update(comment => {
  comment.author.set(newUser)
})
```

Note that you can only do this in the `.update()` or `.create()` blocks.

If you only have the ID of a related record you want to assign, you can use `set id`

```js
await comment.update(() => {
  comment.author.id = userId
})
```

## Advanced relations

### immutableRelation

If you have a relation that cannot change (for example, you don't allow assigning a new comment author), you can use `@immutableRelation` for extra protection and performance:

```js
import { immutableRelation } from 'watermelondb/decorators'

class Comment extends Model {
  // ...
  @immutableRelation('posts', 'post_id') post
  @immutableRelation('users', 'author_id') author
}
```

* * *

## Next steps

➡️ Now the last step of this guide: [**define custom Actions**](./Actions.md)
