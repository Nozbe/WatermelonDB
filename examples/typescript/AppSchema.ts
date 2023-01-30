import { appSchema, tableSchema } from "@nozbe/watermelondb"
import { TableName } from "./ts-example"

export const AppSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TableName.BLOGS,
      columns: [{ name: 'name', type: 'string' }],
    }),
    tableSchema({
      name: TableName.POSTS,
      columns: [
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'blog_id', type: 'string', isIndexed: true },
        { name: 'is_nasty', type: 'boolean' },
      ],
    }),
  ],
})
