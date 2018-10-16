# Defining Models

A **Model** class represents a type of thing in your app. For example, `Post`, `Comment`, `User`.

Before defining a Model, you first need to [define its schema](./Schema.md).

## Create a Model

Let's define the `Post` model:

```js
// model/Post.js
import { Model } from '@nozbe/watermelondb'

export default class Post extends Model {
  static table = 'posts'
}
```

Mark the table name for this Model — the same you defined [in the schema](./Schema.md). Remember to add new Models to `Database`:

```js
// index.js
import Post from 'model/Post'

const database = new Database({
  // ...
  modelClasses: [
    Post,
  ],
})
```

### Associations

Your models almost surely relate to one another. A `Post` has many `Comment`s. And every `Comment` belongs to a `Post`. (Every relation is double-sided). Define those associations like so:

```js
class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }
}

class Comment extends Model {
  static table = 'comments'
  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' },
  }
}
```

On the "child" side (`comments`) you define a `belongs_to` association, and pass a column name (key) that points to the parent (`post_id` is the ID of the post the comment belongs to).

On the "parent" side (`posts`) you define an equivalent `has_many` association and pass the same column name (here named `foreignKey`).

## Add fields

Next, define the Model's _fields_ (properties). Those correspond to [table columns](./Schema.md) defined earlier in the schema.

```js
import { field } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @field('title') title
  @field('body') body
  @field('is_pinned') isPinned
}
```

Fields are defined using ES6 decorators. Pass **column name** you defined in Schema as the argument to `@field`.

**Field types**. Fields are guaranteed to be the same type (string/number/boolean) as the column type defined in Schema. If column is marked `isOptional: true`, fields may also be null.

**Note:** Why do I have to type the field/column name twice? The database convention is to use `snake_case` for names, and the JavaScript convention is to use camelCase. So for any multi-word name, the two differ. Also, for resiliency, we believe it's better to be explicit, because over time, you might want to refactor how you name your JavaScript field names, but column names must stay the same for backward compatibility.

### Date fields

For date fields, use `@date` instead of `@field`. This will return a JavaScript `Date` object (instead of Unix timestamp integer).

```js
import { date } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @date('last_event_at') lastEventAt
}
```

## Relation fields

### To-one relation

To point to a related record, e.g. `Post` a `Comment` belongs to, or author (`User`) of a `Comment`, use `@relation`:

```js
import { relation } from '@nozbe/watermelondb/decorators'

class Comment extends Model {
  // ...
  @relation('posts', 'post_id') post
  @relation('users', 'author_id') author
}
```

**➡️ Learn more:** [Relation API](./Relation.md)

### Children

To point to a list of records that belong to this Model, e.g. all `Comment`s that belong to a `Post`, you can define a simple `Query` using `@children`:

```js
import { children } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  static table = 'posts'
  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
  }

  @children('comments') comments
}
```

Pass the _table name_ of the related records as an argument to `@children`. The resulting property will be a `Query` you can fetch, observe, or count.

**Note:** You must define a `has_many` association in `static associations` for this to work

**➡️ Learn more:** [Queries](./Query.md)

## Advanced

#### Actions

Define **actions** to simplify creating and updating records.

**➡️ Learn more:** [Actions](./Actions.md)

#### Queries

In addition to `@children`, you can define custom Queries or extend existing ones.

**➡️ Learn more:** [Queries](./Query.md)

#### Advanced fields

You can also use these decorators:

- `@text` trims whitespace from user-input text
- `@json` for complex serialized data
- `@readonly` to make the field read-only
- `@nochange` to disallow changes to the field _after the first creation_

**➡️ Learn more:** [Advanced fields](./Advanced/AdvancedFields.md)

* * *

## Next steps

➡️ After you define some Models, learn the [**Create / Read / Update / Delete API**](./CRUD.md)
