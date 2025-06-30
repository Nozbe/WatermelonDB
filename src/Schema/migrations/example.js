// Example usage of the new migration steps
import {
  schemaMigrations,
  createTable,
  addColumns,
  dropTable,
  dropColumns,
  addIndex,
  removeIndex,
} from './index'

// Example migration that demonstrates all the new migration steps
export const exampleMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        // Create a new table
        createTable({
          name: 'comments',
          columns: [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'body', type: 'string' },
          ],
        }),
        // Add columns to existing table
        addColumns({
          table: 'posts',
          columns: [
            { name: 'subtitle', type: 'string', isOptional: true },
            { name: 'is_pinned', type: 'boolean' },
          ],
        }),
        // Add an index to a column
        addIndex({
          table: 'posts',
          column: 'author_id',
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        // Drop columns from a table
        dropColumns({
          table: 'posts',
          columns: ['old_column', 'deprecated_field'],
        }),
        // Remove an index from a column
        removeIndex({
          table: 'posts',
          column: 'unused_index',
        }),
        // Drop an entire table
        dropTable({
          table: 'legacy_table',
        }),
      ],
    },
  ],
})

console.log('Example migrations created successfully!')
