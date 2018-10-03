import { appSchema, tableSchema } from '../../../Schema'
import { addColumns, createTable } from '../../../Schema/migrations'

import { encodeSchema, encodeMigrationSteps } from './index'

describe('encodeSchema', () => {
  it('encodes schema', () => {
    const testSchema = appSchema({
      version: 1,
      tables: [
        tableSchema({
          name: 'tasks',
          columns: [
            { name: 'author_id', type: 'string', isIndexed: true },
            { name: 'order', type: 'number', isOptional: true, isIndexed: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        tableSchema({
          name: 'comments',
          columns: [{ name: 'is_ended', type: 'bool' }, { name: 'reactions', type: 'number' }],
        }),
      ],
    })

    const expectedSchema =
      'create table "tasks" ("id" primary key, "_changed", "_status", "last_modified", "author_id", "order", "created_at");' +
      'create index tasks_author_id on "tasks" ("author_id");' +
      'create index tasks_order on "tasks" ("order");' +
      'create index tasks__status on "tasks" ("_status");' +
      'create table "comments" ("id" primary key, "_changed", "_status", "last_modified", "is_ended", "reactions");' +
      'create index comments__status on "comments" ("_status");'

    expect(encodeSchema(testSchema)).toEqual(expectedSchema)
  })
  it('encodes migrations', () => {
    const migrationSteps = [
      addColumns({
        table: 'posts',
        columns: [
          { name: 'subtitle', type: 'string', isOptional: true },
          { name: 'is_pinned', type: 'bool' },
        ],
      }),
      addColumns({
        table: 'posts',
        columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
      }),
      createTable({
        name: 'comments',
        columns: [
          { name: 'post_id', type: 'string', isIndexed: true },
          { name: 'body', type: 'string' },
        ],
      }),
    ]

    expect(encodeMigrationSteps(migrationSteps)).toEqual('blabla')
  })
})
