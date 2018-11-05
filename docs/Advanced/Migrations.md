# Migrations

**Schema migrations** is the mechanism by which you can add new tables and columns to the database in a backward-compatible way.

Without migrations, if a user of your app upgrades from one version to another, their local database will be cleared at launch, and they will use all their data.

⚠️ Always use migrations!

## Migrations setup

1. Add a new file for migrations:

   ```js
   // app/model/migrations.js

   import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

   export default schemaMigrations({
     migrations: [
       // We'll add migration definitions here later
     ],
   })
   ```

2. Hook up migrations to the Database adapter setup:

   ```js
   import migrations from 'model/migrations'

   const adapter = new SQLiteAdapter({
     schema: mySchema,
     migrationsExperimental: migrations
   })
   ```

   ⚠️ Migrations are currently marked as "experimental", which means that the exact API may change at any moment.
   In a future version, the experimental marker will be remved, and using migrations will be mandatory.

## Migrations workflow

If you want to make schema changes when you use migrations, be sure to do this in this specific order, to minimize the likelihood of making an error:

### Step 1: Add a new migration

First, define the migration - that is, define the **change** that occurs between two versions of schema (such as adding a new table, or a new table column).

Don't change the schema file yet!

```js
// app/model/migrations.js

import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      // ⚠️ Set this to a number one larger than the current schema version
      toVersion: 2,
      steps: [
        // See "Migrations API" for more details
        createTable({
          name: 'comments',
          columns: [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'body', type: 'string' },
          ],
        }),
      ],
    },
  ],
})
```

Refresh your simulator/browser. You should see this error:

> Migrations can't be newer than schema. Schema is version 1 and migrations cover range from 1 to 2

If so, good, move to the next step!

But you might also see an error like "Missing table name in schema", which means you made an error in defining migrations. See "Migrations API" below for details.

### Step 2: Make matching changes in schema

Now it's time to make the actual changes to the schema file — add the same tables or columns as in your migration definition

⚠️ Please double and triple check that your changes to schema match exactly the change you defined in the migration. Otherwise you risk that the app will work when the user migrates, but will fail if it's a fresh install — or vice versa.

⚠️ Don't change the schema version yet

```js
// model/schema.js

export default appSchema({
  version: 1,
  tables: [
    // This is our new table!
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string' },
      ],
    }),
    // ...
  ]
})
```

Refresh the simulator. You should again see the same "Migrations can't be newer than schema" error. If you see a different error, you made a syntax error.

### Step 3: Bump schema version

Now that we made matching changes in the schema (source of truth about tables and columns) and migrations (the change in tables and columns), it's time to commit the change by bumping the version:

```js
// model/schema.js

export default appSchema({
  version: 2,
  tables: [
    // ...
  ]
})
```

If you refresh again, your app should show up without issues — but now you can use the new tables/columns

### Step 4: Test your migrations

Before shipping a new version of the app, please check that your database changes are all compatible:

1. Install the previous version of your app, then update to the version you're about to ship, and make sure it still works (migrations test)
2. Remove the app, and then install the _new_ version of the app, and make sure it works (fresh schema install test)

### Why is order important

It's simply because React Native simulator (and often React web projects) are configured to automatically refresh when you save a file. You don't want to database to accidentally migrate (upgrade) with changes that have a mistake, or changes you haven't yet completed making. By making migrations first, and bumping version last, you can double check you haven't made a mistake.

## Migration API

Each migration must migrate to a version one above the previous migration, and have multiple _steps_ (such as adding a new table, or new columns):

```js
schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'comments',
          columns: [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'body', type: 'string' },
          ],
        }),
        addColumns({
          table: 'posts',
          columns: [
            { name: 'subtitle', type: 'string', isOptional: true },
            { name: 'is_pinned', type: 'boolean' },
          ],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        // ...
      ],
    },
  ],
})
```

### Migration steps:

- `createTable({ name: 'table_name', columns: [ ... ] })` - same API as `tableSchema()`
- `addColumns({ table: 'table_name', columns: [ ... ] })` - you can add one or multiple columns to an existing table. The columns table has the same format as in schema definitions
- Other types of migrations (e.g. deleting or renaming tables and columns) are not yet implemented. See `migrations/index.js`. Please contribute!

## Database reseting and other edge cases

1. When you're **not** using migrations, the database will reset (delete all its contents) whenever you change the schema version
2. If the migration fails, the database will fail to set up. The migration changes will roll back to previous version. This is unlikely, but could happen if you, for example, create a migration that tries to create the same table twice. The reason why the database will fail instead of reset is to avoid losing user data (also it's less confusing in development). You can notice the problem, fix the migration, and ship it again without data loss.
3. When database in the running app has *newer* database version than the schema version defined in code, the database will reset (clear its contents). This is useful in development
4. If there's no available migrations path (e.g. user has app with database version 4, but oldest migration is from version 10 to 11), the database will reset.

### Rolling back changes

There's no automatic "rollback" feature in Watermelon. If you make a mistake in migrations during development, roll back in this order:

1. Comment out any changes made to schema.js
2. Comment out any changes made to migrations.js
3. Decrement schema version number (bring back the original number)

After refreshing app, the database should reset to previous state. Now you can correct your mistake and apply changes again (please do it in order described in "Migrations workflow").
