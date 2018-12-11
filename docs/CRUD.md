# Create, Read, Update, Delete

When you have your [Schema](./Schema.md) and [Models](./Model.md) defined, learn how to manipulate them!

## Collections

The `Collection` object is how you find, query, and create new records of a given type.

#### Get a collection

```js
const postsCollection = database.collections.get('posts')
```

Pass the [table name](./Schema.md) as the argument.

#### Find a record (by ID)

```js
const post = await postsCollection.find('abcdef')
```

`find()` returns a Promise. If the record cannot be found, the Promise will be rejected.

#### Query records

Find a list of records matching given conditions using `.query()`:

```js
const allPosts = await postsCollection.query().fetch()
const starredPosts = await postsCollection.query(Q.where('is_starred', true)).fetch()
```

**➡️ Learn more:** [Queries](./Query.md)

### Create a new record

```js
const newPost = await postsCollection.create(post => {
  post.title = 'New post'
  post.body = 'Lorem ipsum...'
})
```

`.create()` takes a "builder function". In the example above, the builder will get a `Post` object as an argument. Use this object to set values for [fields you defined](./Model.md).

**Note:** Always `await` the Promise returned by `create` before you access the created record.

**Note:** You can only use field setters in `create()` or `update()` builder functions.

## Model actions

### Update a record

```js
await somePost.update(post => {
  post.title = 'Updated title'
})
```

Like creating, updating takes a builder function, where you can use field setters.

**Note:** Always `await` the Promise returned by `update` before you access the modified record.

### Delete a record

There are two ways of deleting records: permanent and syncable. If you only use Watermelon as a local database, destroy records permanently:

```js
await somePost.destroyPermanently()
```

If you use Watermelon [with a Sync service](./Advanced/Sync.md), call `markAsDeleted()` instead.

**Note:** Don't access, update, or observe records after they're destroyed.

## Advanced

- `Model.observe()` - usually you only use this [when connecting records to components](./Components.md), but you can manually observe a record outside of React components. The returned [RxJS](https://github.com/reactivex/rxjs) `Observable` will emit the record immediately upon subscription, and then every time the record is updated. If the record is deleted, the Observable will complete.
- `Query.observe()`, `Relation.observe()` — analagous to the above, but for [Queries](./Query.md) and [Relations](./Relation.md)
- `Query.observeWithColumns()` - used for [sorted lists](./Components.md)
- `Collection.findAndObserve(id)` — same as using `.find(id)` and then calling `record.observe()`
- `Model.prepareUpdate()`, `Collection.prepareCreate`, `Database.batch` — used for [batch updates](./Actions.md)

* * *

## Next steps

➡️ Now that you can create and update records, [**connect them to React components**](./Components.md)

