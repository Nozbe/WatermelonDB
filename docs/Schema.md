# Schema

When using WatermelonDB, you're dealing with **Models** and **Collections**. However, underneath Watermelon sits an **underlying database** (SQLite or LokiJS) which speaks a different language: **tables and columns**. Together, those are called a **database schema** and we must define it first.

## Defining a Schema

Say you want Models `Post`, `Comment` in your app. For each of those Models, you define a table. And for every field of a Model (e.g. name of the blog post, author of the comment) you define a column. For example:

```js
// model/schema.js
import { appSchema, tableSchema } from 'watermelondb'

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'posts',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'subtitle', type: 'string', isOptional: true },
        { name: 'body', type: 'string' },
        { name: 'is_pinned', type: 'bool' },
      ]
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'body', type: 'string' },
        { name: 'post_id', type: 'string', isIndexed: true },
      ]
    }),
  ]
})
```

**Note:** It is database convention to use plural and snake_case names for table names. Column names are also snake_case. So `Post` become `posts` and `createdAt` becomes `created_at`.

### Column types

Columns have one of three types: `string`, `number`, or `bool`.

Fields of those types will default to `''`, `0`, or `false` respectively, if you create a record with a missing field.

To allow fields to be `null`, mark the column as `isOptional: true`.

### Naming conventions

To add a relation to a table (e.g. `Post` where a `Comment` was published, or author of a comment), add a string column ending with `_id`:

```js
{ name: 'post_id', type: 'string' },
{ name: 'author_id', type: 'string' },
```

Boolean columns should have names starting with `is_`:

```js
{ name: 'is_pinned', type: 'bool' }
```

Date fields should be `number` (dates are stored as Unix timestamps) and have names ending with `_at`:

```js
{ name: 'last_seen_at', type: 'number', isOptional: true }
```

### Special columns

All tables automatically have a string column `id` to uniquely identify records. (Also three special columns for [sync purposes](./Implementation/Sync.md)). You can add special `created_at` / `updated_at` columns to enable [automatic create/update tracking](./Advanced/CreateUpdateTracking.md).

### Modifying Schema

Whenever you change the Schema, you must increment the version number. During development, this will cause the database to clear completely on next launch.

To seamlessly change the schema (without deleting data), use [Migrations](./Advanced/Migrations.md).

⚠️ Always use Migrations if you already shipped your app.

### Indexing

To enable database indexing, add `isIndexed: true` to a column.

Indexing makes querying by a column faster, at the slight expense of create/update speed and database size.

For example, you will often want to query all comments belonging to a post (that is, query comments by its `post_id` column), and so you should mark the `post_id` column as indexed.

However, if you rarely query all comments by its author, indexing `author_id` is probably not worth it.

In general, most `_id` fields are indexed. Sometimes, `bool` fields are worth indexing if you often use it for queries. However, you should almost never index date (`_at`) columns or `string` columns.

* * *

## Next steps

➡️ After you define your schema, go ahead and [**define your Models**](./Model.md)
