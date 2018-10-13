import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'blogs',
      columns: [{ name: 'name', type: 'string' }],
    }),
    tableSchema({
      name: 'posts',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'subtitle', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'blog_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'body', type: 'string' },
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'is_nasty', type: 'boolean' },
      ],
    }),
  ],
})
