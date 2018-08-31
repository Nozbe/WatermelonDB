# Advanced Fields

### `@text`

You can use `@text` instead of `@field` to enable user text sanitization. When setting a new value on a `@text` field, excess whitespace will be trimmed from both ends from the string.

```js
import { date } from 'watermelondb/decorators'

class Post extends Model {
  // ...
  @text('body') body
}
```

### `@json`

If you have a lot of metadata about a record, you can use a single `@json` field to contain that information instead of adding multiple columns.

First, add a string column to [the schema](../Schema.md).:

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
import { json } from 'watermelondb/decorators'

class Comment extends Model {
  // ...
  @json('reactions', sanitizeReactions) reaction
}
```

As the second argument, pass a **sanitizer function**. This is a function that receives whatever `JSON.parse()` returns for the raw value, and ought to return whatever type you expect in your app. In other words, it turns raw, dirty, untrusted data (that might be missing, invalid format, or broken by a bug in previous version of the app) into trusted format.

The sanitizer might also receive `null` if the column is nullable and has no value, or `undefined` if the field doesn't contain valid JSON.

For example, to ensure the JSON is an array of strings, you could write:

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

JSON fields go against relational, lazy nature of Watermelon, because **you can't query by the contents of JSON fields**. If you need or might in the future need to query or count records by some piece of data, just use standard fields. 

Only use JSON fields when you need the flexibility of complex freeform data, or the speed of having metadata without querying another table, and you are sure that you won't need to query by those metadata.

### `@nochange`



### Custom observable fields
