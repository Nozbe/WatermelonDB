# Actions

Although you can [`.create()` and `.update()` records](./CRUD.md) anywhere in your app, we recommend **defining explicit Actions** to encapsulate all ways to make changes.

## Defining explicit Actions

An **Action** is a function that can modify the database (create, update, and delete records).

To define it, just add a method to a `Model` class marked with the `@writer` decorator

```js
import { action } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...

  @writer async addComment(body, author) {
    return await this.collections.get('comments').create(comment => {
      comment.post.set(this)
      comment.author.set(author)
      comment.body = body
    })
  }
}
```

**Note:**

- Always mark actions as `async` and remember to `await` on `.create()` and `.update()`
- You can use `this.collections` to access `Database.collections`

**Another example**: updater action on `Comment`:

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

Now we can create a comment and immediately mark it as spam:

```js
const comment = await post.addComment('Lorem ipsum', someUser)
await comment.markAsSpam()
```

## Batch updates

Whenever you make more than one change (create, delete or update records) in an action, you should **batch them**.

> It means that the app doesn't have to go back and forth with the database (sending one command, waiting for the response, then sending another), but instead sends multiple commands in one big batch. This is faster, safer, and can avoid subtle bugs in your app

Take an action that changes a `Post` into spam:

```js
class Post extends Model {
  // ...
  @writer async createSpam() {
    await this.update(post => {
      post.title = `7 ways to lose weight`
    })
    await this.collections.get('comments').create(comment => {
      comment.post.set(this)
      comment.body = "Don't forget to comment, like, and subscribe!"
    })
  }
}
```

Let's modify it to use batching:

```js
class Post extends Model {
  // ...
  @writer async createSpam() {
    await this.batch(
      this.prepareUpdate(post => {
        post.title = `7 ways to lose weight`
      }),
      this.collections.get('comments').prepareCreate(comment => {
        comment.post.set(this)
        comment.body = "Don't forget to comment, like, and subscribe!"
      })
    )
  }
}
```

**Note**:

- Call `await this.batch` in the Action (outside of actions, you can also call `.batch()` [on the `Database` object](./CRUD.md))
- Pass the list of **prepared operations** as arguments:
  - Instead of calling `await record.update()`, pass `record.prepareUpdate()` — note lack of `await`
  - Instead of `await collection.create()`, use `collection.prepareCreate()` or `collection.prepareCreateFromDirtyRaw({ put your JSON here })`
  - Instead of `await record.markAsDeleted()`, use `record.prepareMarkAsDeleted()`
  - Instead of `await record.destroyPermanently()`, use `record.prepareDestroyPermanently()`
  - You can pass falsy values (null, undefined, false) to batch — they will simply be ignored.
  - You can also pass a single array argument instead of a list of arguments
- Otherwise, the API is the same!

## Calling Actions from Actions

If you try to call an Action from another Action, you'll notice that it won't work. This is because while Action is running, no other Action can run simultaneously. To override this behavior, wrap the Action call in `this.callWriter`:

```js
class Comment extends Model {
  // ...

  @writer async appendToPost() {
    const post = await this.post.fetch()
    // `appendToBody` is an `@writer` on `Post`, so we call callWriter to allow it
    await this.callWriter(() => post.appendToBody(this.body))
  }
}
```

## Delete action

When you delete, say, a `Post`, you generally want all `Comment`s that belong to it to be deleted as well.

To do this, override `markAsDeleted()` (or `destroyPermanently()` if you don't sync) to explicitly delete all children as well.

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

Then to actually delete the post:

```js
database.write(async () => {
  await post.markAsDeleted()
})
```

**Note:**

- Use `Query.destroyAllPermanently()` on all dependent `@children` you want to delete
- Remember to call `super.markAsDeleted` — at the end of the method!

## Inline actions

If you want to call a number of write operations outside of a Model action, do it like so:

```js
// Note: function passed to `database.write()` MUST be asynchronous
const newPost = await database.write(async action => {
  const posts = database.collections.get('posts')
  const post = await posts.create( /* configure Post here */ )

  // Note: to call an action from an inline action, call `action.callWriter`:
  await action.callWriter(() => post.markAsPromoted())

  // Note: Value returned from the wrapped function will be returned to `database.write` caller
  return post
})
```

## Advanced: Why actions are necessary?

WatermelonDB is highly asynchronous, which is a BIG challange in terms of achieving consistent data. Read this only if you are curious:

> Consider a function `markCommentsAsSpam` that fetches a list of comments on a post, and then marks them all as spam. The two operations (fetching, and then updating) are asynchronous, and some other operation that modifies the database could run in between. And it could just happen to be a function that adds a new comment on this post. Even though the function completes *successfully*, it wasn't *actually* successful at its job.
>
> This example is trivial. But others may be far more dangerous. If a function fetches a record to perform an update on, this very record could be deleted midway through, making the action fail (and potentially causing the app to crash, if not handled properly). Or a function could have invariants determining whether the user is allowed to perform an action, that would be invalidated during action's execution. Or, in a collaborative app where access permissions are represented by another object, parallel execution of different actions could cause those access relations to be left in an inconsistent state.
>
> The worst part is that analyzing all *possible* interactions for dangers is very hard, and having sync that runs automatically makes them very likely.
>
> Solution? Group together related reads and writes together in an Action, enforce that writes MUST occur in an Action, and only allow one Action to run at the time. This way, it's guaranteed that in an action, you're looking at a consistent view of the world. On the other hand, most reads are safe to perform without grouping them. If you suspect they're not, you can also wrap them in an Action.

* * *

## Next steps

➡️ Now that you've mastered all basics of Watermelon, go create some powerful apps — or keep reading [**advanced guides**](./README.md)
