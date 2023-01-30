---
title: Writers, Readers, batching
hide_title: true
---

# Writers, Readers, and batching

Think of this guide as a part two of [Create, Read, Update, Delete](./CRUD.md).

As mentioned previously, you can't just modify WatermelonDB's database anywhere. All changes must be done within a **Writer**.

There are two ways of defining a writer: inline and by defining a **writer method**.

### Inline writers

Here is an inline writer, you can invoke it anywhere you have access to the `database` object:

```js
// Note: function passed to `database.write()` MUST be asynchronous
const newPost = await database.write(async => {
  const post = await database.get('posts').create(post => {
    post.title = 'New post'
    post.body = 'Lorem ipsum...'
  })
  const comment = await database.get('comments').create(comment => {
    comment.post.set(post)
    comment.author.id = someUserId
    comment.body = 'Great post!'
  })

  // Note: Value returned from the wrapped function will be returned to `database.write` caller
  return post
})
```

### Writer methods

Writer methods can be defined on `Model` subclasses by using the `@writer` decorator:

```js
import { writer } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...

  @writer async addComment(body, author) {
    const newComment = await this.collections.get('comments').create((comment) => {
      comment.post.set(this)
      comment.author.set(author)
      comment.body = body
    })
    return newComment
  }
}
```

We highly recommend defining writer methods on `Models` to organize all code that changes the database in one place, and only use inline writers sporadically.

Note that this is the same as defining a simple method that wraps all work in `database.write()` - using `@writer` is simply more convenient.

**Note:**

- Always mark actions as `async` and remember to `await` on `.create()` and `.update()`
- You can use `this.collections` to access `Database.collections`

**Another example**: updater action on `Comment`:

```js
class Comment extends Model {
  // ...
  @field('is_spam') isSpam

  @writer async markAsSpam() {
    await this.update((comment) => {
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

When you make multiple changes in a writer, it's best to **batch them**.

Batching means that the app doesn't have to go back and forth with the database (sending one command, waiting for the response, then sending another), but instead sends multiple commands in one big batch. This is faster, safer, and can avoid subtle bugs in your app

Take an action that changes a `Post` into spam:

```js
class Post extends Model {
  // ...
  @writer async createSpam() {
    await this.update((post) => {
      post.title = `7 ways to lose weight`
    })
    await this.collections.get('comments').create((comment) => {
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
      this.prepareUpdate((post) => {
        post.title = `7 ways to lose weight`
      }),
      this.collections.get('comments').prepareCreate((comment) => {
        comment.post.set(this)
        comment.body = "Don't forget to comment, like, and subscribe!"
      }),
    )
  }
}
```

**Note**:

- You can call `await this.batch` within `@writer` methods only. You can also call `database.batch()` within a `database.write()` block.
- Pass the list of **prepared operations** as arguments:
  - Instead of calling `await record.update()`, pass `record.prepareUpdate()` — note lack of `await`
  - Instead of `await collection.create()`, use `collection.prepareCreate()`
  - Instead of `await record.markAsDeleted()`, use `record.prepareMarkAsDeleted()`
  - Instead of `await record.destroyPermanently()`, use `record.prepareDestroyPermanently()`
  - Advanced: you can pass `collection.prepareCreateFromDirtyRaw({ put your JSON here })`
  - You can pass falsy values (null, undefined, false) to batch — they will simply be ignored.
  - You can also pass a single array argument instead of a list of arguments

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

## Advanced: Why are readers and writers necessary?

WatermelonDB is highly asynchronous, which is a BIG challange in terms of achieving consistent data. Read this only if you are curious:

<details>
  <summary>Why are readers and writers necessary?</summary>

Consider a function `markCommentsAsSpam` that fetches a list of comments on a post, and then marks them all as spam. The two operations (fetching, and then updating) are asynchronous, and some other operation that modifies the database could run in between. And it could just happen to be a function that adds a new comment on this post. Even though the function completes _successfully_, it wasn't _actually_ successful at its job.

This example is trivial. But others may be far more dangerous. If a function fetches a record to perform an update on, this very record could be deleted midway through, making the action fail (and potentially causing the app to crash, if not handled properly). Or a function could have invariants determining whether the user is allowed to perform an action, that would be invalidated during action's execution. Or, in a collaborative app where access permissions are represented by another object, parallel execution of different actions could cause those access relations to be left in an inconsistent state.

The worst part is that analyzing all _possible_ interactions for dangers is very hard, and having sync that runs automatically makes them very likely.

Solution? Group together related reads and writes together in an Writer, enforce that all writes MUST occur in a Writer, and only allow one Writer to run at the time. This way, it's guaranteed that in a Writer, you're looking at a consistent view of the world. Most simple reads are safe to do without groupping them, however if you have multiple related reads, you also need to wrap them in a Reader.

</details>

## Advanced: Readers

Readers are an advanced feature you'll rarely need.

Because WatermelonDB is asynchronous, if you make multiple separate queries, normally you have no guarantee that no records were created, updated, or deleted between fetching these queries.

Code within a Reader, however, has a guarantee that for the duration of the Reader, no changes will be made to the database (more precisely, no Writer can execute during Reader's work).

For example, if you were writing a custom XML data export feature for your app, you'd want the information there to be fully consistent. Therefore, you'd wrap all queries within a Reader:

```js
database.read(async () => {
  // no changes will happen to the database until this function exits
})

// alternatively:
class Blog extends Model {
  // ...

  @reader async exportBlog() {
    const posts = await this.posts.fetch()
    const comments = await this.allComments.fetch()
    // ...
  }
}
```

## Advanced: nesting writers or readers

If you try to call a Writer from another Writer, you'll notice that it won't work. This is because while a Writer is running, no other Writer can run simultaneously. To override this behavior, wrap the Writer call in `this.callWriter`:

```js
class Comment extends Model {
  // ...

  @writer async appendToPost() {
    const post = await this.post.fetch()
    // `appendToBody` is an `@writer` on `Post`, so we call callWriter to allow it
    await this.callWriter(() => post.appendToBody(this.body))
  }
}

// alternatively:
database.write(async (writer) => {
  const post = await database.get('posts').find('abcdef')
  await writer.callWriter(() => post.appendToBody('Lorem ipsum...')) // appendToBody is a @writer
})
```

The same is true with Readers - use `callReader` to nest readers.

---

## Next steps

➡️ Now that you've mastered all basics of Watermelon, go create some powerful apps — or keep reading [**advanced guides**](./README.md)
