# Create/Update tracking

You can add per-table support for create/update tracking. When you do this, the Model will have information about when it was created, and when it was last updated.

### When to use this

**Use create tracking**:

- When you display to the user when a thing (e.g. a Post, Comment, Task) was created
- If you sort created items chronologically (Note that Record IDs are random strings, not auto-incrementing integers, so you need create tracking to sort chronologically)

**Use update tracking**:

- When you display to the user when a thing (e.g. a Post) was modified

**Note**: you _don't have to_ enable both create and update tracking. You can do either, both, or none.

### How to do this

**Step 1:** Add to the [schema](../Schema.md):

```js
tableSchema({
  name: 'posts',
  columns: [
    // other columns
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
}),
```

**Step 2:** Add this to the Model definition:

```js
import { date, readonly } from '@nozbe/watermelondb/decorators'

class Post extends Model {
  // ...
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt
}
```

Again, you can add just `created_at` column and field if you don't need update tracking.

### How this behaves

If you have the magic `createdAt` field defined on the Model, the current timestamp will be set when you first call `collection.create()` or `collection.prepareCreate()`. It will never be modified again.

If the magic `updatedAt` field is also defined, then after creation, `model.updatedAt` will have the same value as `model.createdAt`. Then every time you call `model.update()` or `model.prepareUpdate()`, `updatedAt` will be changed to the current timestamp.
