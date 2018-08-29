# Creation/Update tracking

Why

Behavior

Add schema

Add fields


### created_at/updated_at

If you defined the special `created_at` / `updated_at` columns in the schema, you must also define a corresponding field:

```js
import { date, readonly } from 'watermelondb/decorators'

class Post extends Model {
  // ...
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt
}
```





You can optionally add one or both of these columns to the schema:

```js
{ name: 'created_at', type: 'number' },
{ name: 'updated_at', type: 'number' },
```

… to enable automatic creation/update tracking. (TODO: Add link for more details)
