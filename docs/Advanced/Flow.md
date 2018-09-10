# Watermelon ❤️ Flow

Watermelon was developed with [Flow](https://flow.org) in mind.

If you're a Flow user yourself (and we highly recommend it!), here's some things you need to keep in mind:

## Setup

Add to your `.flowconfig` file:

```ini
[options]

module.name_mapper='^@nozbe/watermelondb\(.*\)$' -> '<PROJECT_ROOT>/node_modules/@nozbe/watermelondb/src\1'
```

Note that this won't work if you put the entire `node_modules/` folder under the `[ignore]` section. In that case, change it to only ignore the specific node modules that throw errors in your app, so that Flow can scan Watermelon files.

## Tables and columns

Table and column names are **opaque types** in Flow.

So if you try to use simple strings, like so:

```js
class Comment extends Model {
  static table = 'comments'

  @text('body') body
}
```

You'll get errors, because you're passing `'comments'` (a `string`) where `TableName<Comment>` is expected, and `'body'` (again, a `string`) where `ColumnName` is expected.

When using Watermelon with Flow, you must pre-define all your table and column names in one place, then only use those symbols (and not strings) in all other places.

We recommend defining symbols like this:

```js
// File: model/schema.js
// @flow

import { tableName, columnName, type TableName, appSchema, tableSchema } from '@nozbe/watermelondb'
import type Comment from './Comment.js'

export const Tables = {
  comments: (tableName('comments'): TableName<Comment>),
  // ...
}

export const Columns = {
  comments: {
    body: columnName('body'),
    // ...
  }
}

export const appSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: Tables.comments,
      columns: [
        { name: Columns.comments.body, type: 'string' },
      ],
    }),
    // ...
  ]
})
```

And then using them like so:

```js
// File: model/Comment.js
// @flow

import { Model } from '@nozbe/watermelondb'
import { text } from '@nozbe/watermelondb/decorators'

import { Tables, Columns } from './schema.js'

const Column = Columns.comments

export default class Comment extends Model {
  static table = Tables.comments

  @text(Column.body) body: string
}
```

### But isn't that a lot of boilerplate?

Yes, it looks more boilerplate'y than the non-Flow examples, however:

- you're protected from typos — strings are defined once
- easier refactoring — you only change column name in one place
- no orphan columns or tables — no way to accidentally refer to a column or table that was removed from the schema
- `TableName` is typed with the model class it refers to, which allows Flow to find other mistakes in your code

In general, we find that untyped string constants lead to bugs, and defining typed constants is a good practice.

### associations

When using Flow, you define model associations like this:

```js
import { Model, associations } from '@nozbe/watermelondb'
import { Tables, Columns } from './schema.js'

const Column = Columns.posts

class Post extends Model {
  static table = Tables.posts
  static associations = associations(
    [Tables.comments, { type: 'has_many', foreignKey: Columns.comments.postId }],
    [Tables.users, { type: 'belongs_to', key: Column.authorId }],
  )
}
```

## Common types

Many types are tagged with the model class the type refers to:

```js
TableName<Post> // a table name referring to posts
Collection<Post> // the Collection for posts
Relation<Comment> // a relation that can fetch a Comment
Query<Comment> // a query that can fetch many Comments
```

Always mark the type of model fields. Remember to include `?` if the underlying table column is optional. Flow can't check if model fields match the schema or if they match the decorator's signature.

```js
@text(Column.body) body: string
@date(Column.createdAt) createdAt: Date
@date(Column.archivedAt) archivedAt: ?Date
```

If you need to refer to an ID of a record, always use the `RecordId` type alias, not `string` (they're the same, but the former is self-documenting).

If you ever access the record's raw data (DON'T do that unless you *really* know what you're doing), use `DirtyRaw` to refer to raw data from external sources (database, server), and `RawRecord` after it was passed through `sanitizedRaw`.
