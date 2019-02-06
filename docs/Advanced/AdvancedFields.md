# Advanced Fields

## `@text`

You can use `@text` instead of `@field` to enable user text sanitization. When setting a new value on a `@text` field, excess whitespace will be trimmed from both ends from the string.

```js
import { text } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @text('body') body
}
```

## `@json`

If you have a lot of metadata about a record (say, an object with many keys, or an array of values), you can use a `@json` field to contain that information in a single string column (serialized to JSON) instead of adding multiple columns or a relation to another table.

⚠️ This is an advanced feature that comes with downsides — make sure you really need it

First, add a string column to [the schema](../Schema.md):

```js
tableSchema({
  name: 'comments',
  columns: [
    { name: 'reactions', type: 'string' }, // You can add isOptional: true, if appropriate
  ],
})
```

Then in the Model definition:

```js
import { json } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @json('reactions', sanitizeReactions) reactions
}
```

Now you can set complex JSON values to a field:

```js
comment.update(() => {
  comment.reactions = ['up', 'down', 'down']
})
```

As the second argument, pass a **sanitizer function**. This is a function that receives whatever `JSON.parse()` returns for the serialized JSON, and returns whatever type you expect in your app. In other words, it turns raw, dirty, untrusted data (that might be missing, or malformed by a bug in previous version of the app) into trusted format.

The sanitizer might also receive `null` if the column is nullable, or `undefined` if the field doesn't contain valid JSON.

For example, if you need the field to be an array of strings, you can ensure it like so:

```js
const sanitizeReactions = rawReactions => {
  return Array.isArray(rawReactions) ? rawReactions.map(String) : []
}
```

If you don't want to sanitize JSON, pass an identity function:

```js
const sanitizeReactions = json => json
```

**Warning about JSON fields**:

JSON fields go against relational, lazy nature of Watermelon, because **you can't query or count by the contents of JSON fields**. If you need or might need in the future to query records by some piece of data, don't use JSON.

Only use JSON fields when you need the flexibility of complex freeform data, or the speed of having metadata without querying another table, and you are sure that you won't need to query by those metadata.

## `@nochange`

For extra protection, you can mark fields as `@nochange` to ensure they can't be modified. Always put `@nochange` before `@field` / `@date` / `@text`

```js
import { field, nochange } from '@nozbe/watermelondb/decorators'

class User extends Model {
  // ...
  @nochange @field('is_owner') isOwner
}
```

`user.isOwner` can only be set in the `collection.create()` block, but will throw an error if you try to set a new value in `user.update()` block.

### `@readonly`

Similar to `@nochange`, you can use the `@readonly` decorator to ensure a field cannot be set at all. Use this for [create/update tracking](./CreateUpdateTracking.md), but it might also be useful if you use Watermelon with a [Sync engine](../Advanced/Sync.md) and a field can only be set by the server.

## Custom observable fields

You're in advanced [RxJS](https://github.com/ReactiveX/rxjs) territory now! You have been warned.

Say, you have a Post model that has many Comments. And a Post is considered to be "popular" if it has more than 10 comments.

You can add a "popular" badge to a Post component in two ways.

One is to simply observe how many comments there are [in the component](../Components.md):

```js
const enhance = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  commentCount: post.comments.observeCount()
}))
```

And in the `render` method, if `props.commentCount > 10`, show the badge.

Another way is to define an observable property on the Model layer, like so:

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

And then you can directly connect this to the component:

```js
const enhance = withObservables(['post'], ({ post }) => ({
  isPopular: post.isPopular,
}))
```

`props.isPopular` will reflect whether or not the Post is popular. Note that this is fully observable, i.e. if the number of comments rises above/falls below the popularity threshold, the component will re-render. Let's break it down:

- `this.comments.observeCount()` - take the Observable number of comments
- `map$(comments => comments > 10)` - transform this into an Observable of boolean (popular or not)
- `distinctUntilChanged()` - this is so that if the comment count changes, but the popularity doesn't (it's still below/above 10), components won't be unnecessarily re-rendered
- `@lazy` - also for performance (we only define this Observable once, so we can re-use it for free)

Let's make this example more complicated. Say the post is **always** popular if it's marked as starred. So if `post.isStarred`, then we don't have to do unnecessary work of fetching comment count:

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

- `this.observe()` - if the Post changes, it might change its popularity status, so we observe it
- `this.comments.observeCount().pipe(map$(comments => comments > 10))` - this part is the same, but we only observe it if the post is starred
- `switchMap(post => post.isStarred ? of$(true) : ...)` - if the post is starred, we just return an Observable that emits `true` and never changes.
- `distinctUntilKeyChanged('isStarred')` - for performance, so that we don't re-subscribe to comment count Observable if the post changes (only if the `isStarred` field changes)
- `distinctUntilChanged()` - again, don't emit new values, if popularity doesn't change
