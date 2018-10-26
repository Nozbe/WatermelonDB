# Migrations

**Schema migrations** is the mechanism by which you can add new tables and columns to the database in a backward-compatible way. That is, when users of your app upgrade from version 1.0 to 2.0 that have a different database schema, they won't notice a thing.




### Why you need Migrations

## Migrations setup



## Migrations workflow

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

1. Add a new migration - example with new table
2. Match changes in Schema
3. Bump schema version
4. Test your migrations!!!

Order is important! Explain the dangers of doing this wrong

## Migration types

### createTable

### addColumns

### adding optionality

### unimplemented migration types

## Database reseting and other edge cases

1. When NOT using migrations
2. FAIL if migrations fails…
3. DB newer than schema
4. No available migrations
