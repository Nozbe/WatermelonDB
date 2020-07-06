import { appSchema, tableSchema } from '../../../Schema'
import { addColumns, createTable, unsafeExecuteSql } from '../../../Schema/migrations'

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
          columns: [{ name: 'is_ended', type: 'boolean' }, { name: 'reactions', type: 'number' }],
        }),
      ],
    })

    const expectedSchema =
      'create table "tasks" ("id" primary key, "_changed", "_status", "author_id", "order", "created_at");' +
      'create index "tasks_author_id" on "tasks" ("author_id");' +
      'create index "tasks_order" on "tasks" ("order");' +
      'create index "tasks__status" on "tasks" ("_status");' +
      'create table "comments" ("id" primary key, "_changed", "_status", "is_ended", "reactions");' +
      'create index "comments__status" on "comments" ("_status");'

    expect(encodeSchema(testSchema)).toBe(expectedSchema)
  })
  it(`encodes schema with unsafe SQL`, () => {
    const testSchema = appSchema({
      version: 1,
      tables: [
        tableSchema({
          name: 'tasks',
          columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
          unsafeSql: sql => sql.replace(/create table "tasks" [^)]+\)/, '$& without rowid'),
        }),
      ],
      unsafeSql: sql => `create blabla;${sql}`,
    })

    const expectedSchema =
      'create blabla;' +
      'create table "tasks" ("id" primary key, "_changed", "_status", "author_id") without rowid;' +
      'create index "tasks_author_id" on "tasks" ("author_id");' +
      'create index "tasks__status" on "tasks" ("_status");'

    expect(encodeSchema(testSchema)).toBe(expectedSchema)
  })
  it('encodes migrations', () => {
    const migrationSteps = [
      addColumns({
        table: 'posts',
        columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
      }),
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
          { name: 'author_id', type: 'string', isIndexed: true },
          { name: 'is_pinned', type: 'boolean', isIndexed: true },
        ],
      }),
    ]

    const expectedSQL =
      `alter table "posts" add "subtitle";` +
      `update "posts" set "subtitle" = null;` +
      `create table "comments" ("id" primary key, "_changed", "_status", "post_id", "body");` +
      `create index "comments_post_id" on "comments" ("post_id");` +
      `create index "comments__status" on "comments" ("_status");` +
      `alter table "posts" add "author_id";` +
      `update "posts" set "author_id" = '';` +
      `create index "posts_author_id" on "posts" ("author_id");` +
      `alter table "posts" add "is_pinned";` +
      `update "posts" set "is_pinned" = 0;` +
      `create index "posts_is_pinned" on "posts" ("is_pinned");`

    expect(encodeMigrationSteps(migrationSteps)).toBe(expectedSQL)
  })
  it(`encodes migrations with unsafe SQL`, () => {
    const migrationSteps = [
      addColumns({
        table: 'posts',
        columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
        unsafeSql: sql => `${sql}bla;`,
      }),
      createTable({
        name: 'comments',
        columns: [{ name: 'body', type: 'string' }],
        unsafeSql: sql => sql.replace(/create table [^)]+\)/, '$& without rowid'),
      }),
      unsafeExecuteSql('boop;'),
    ]

    const expectedSQL =
      `alter table "posts" add "subtitle";` +
      `update "posts" set "subtitle" = null;` +
      'bla;' +
      `create table "comments" ("id" primary key, "_changed", "_status", "body") without rowid;` +
      `create index "comments__status" on "comments" ("_status");` +
      'boop;'

    expect(encodeMigrationSteps(migrationSteps)).toBe(expectedSQL)
  })
})
