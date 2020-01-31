# Common Mistakes

This page will try collect some common mistakes and how to avoid them.

## Not ensuring database writes happen in an action

Consider the following contrived example. We have 2 models: `Post` and `Comment`.

```
type Post = {
    total_good_comments: number
}

type Comment = {
    text: string,
    is_good: boolean
}
```

So a `Post` has many `Comment`s. And `total_good_comments` is the sum of all comments with `is_good=true`.
We have a function here that will mark an array of comments as good, and then cache the number of good comments 
on the post. NOTE: There are better ways of achieving this behaviour - this is simply for demonstration purposes.

```
const setCommentsAsGood = async (database, post, commentsToUpdate) => {
    const updates = []

    // 1. Set all comments as good

    for(let comment of commentsToUpdate) {
        updates.push(comment.prepareUpdate(comment => {
            comment.is_good = true
        }))
    }

    // 2. We fetch all comments to figure out how many good there are

    const comments = await post.comments.fetch()

    // 3. We cache the number of good comments

    updates.push(post.prepareUpdate(post => {
        post.total_good_comments = comments.filter(comment => comment.is_good).length
    }))

    database.batch(...updates)
}
```

There are multiple issues with this example.

1. Once we call `prepareUpdate` on a model we cannot call it again before we have flushed the updates to the database. For instance,

```
comment.prepareUpdate(comment => {
    comment.comment = 'Good comment'
})
comment.prepareUpdate(comment => {
    comment.comment = 'Good comment'
})
```

would cause a `Diagnostic Error: Cannot update a record with pending updates` to be thrown. Therefore, `prepareUpdate` and `database.batch` have 
to happen *synchronously* or within an [Action](./Actions.md).

If we look closely at comment (2). 

```
const comments = await post.comments.fetch()
```

here we make the execution *asynchronous*. This means `prepareUpdate` and `database.batch` no longer happen *synchronously*. Using pseudo code we can say that

**BAD**

```
comment.prepareUpdate(comment => {
    comment.is_good = true
})
const comments = await post.comments.fetch()
database.batch(...updates)
```

**GOOD**

```
const comments = await post.comments.fetch()
comment.prepareUpdate(comment => {
    comment.is_good = true
})
database.batch(...updates)
```

Now we have updated our code to have synchronous execution between `prepareUpdate` and `database.batch`. To make this even better we can 
utilize WatermelonDB's Actions

**BEST**

```
database.action(() => {
    const comments = await post.comments.fetch()
    comment.prepareUpdate(comment => {
        comment.is_good = true
    })
    database.batch(...updates)
})
```

Then WatermelonDB will prevent any concurrent writes. So our final example becomes

```
const setCommentsAsGood = async (database, post, commentsToUpdate) => {
    // 2. We fetch all comments to figure out how many good there are

    const comments = await post.comments.fetch()
    
    const updates = []

    // 1. Set all comments as good

    for(let comment of commentsToUpdate) {
        updates.push(comment.prepareUpdate(comment => {
            comment.is_good = true
        }))
    }

    // 3. We cache the number of good comments

    updates.push(post.prepareUpdate(post => {
        post.total_good_comments = comments.filter(comment => comment.is_good).length
    }))

    database.batch(...updates)
}
```