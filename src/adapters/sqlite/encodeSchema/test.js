/* eslint-disable prefer-template */
import { appSchema, tableSchema } from '../../../Schema'
import {
  addColumns,
  createTable,
  destroyColumn,
  renameColumn,
  unsafeExecuteSql,
} from '../../../Schema/migrations'

import { encodeSchema, encodeMigrationSteps, encodeCreateIndices, encodeDropIndices } from './index'

const expectedCommonSchema =
  'create table "local_storage" ("key" varchar(16) primary key not null, "value" text not null);' +
  'create index "local_storage_key_index" on "local_storage" ("key");'

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
      columns: [
        { name: 'is_ended', type: 'boolean' },
        { name: 'reactions', type: 'number' },
      ],
    }),
  ],
})

describe('encodeSchema', () => {
  it('encodes schema', () => {
    expect(encodeSchema(testSchema)).toBe(
      expectedCommonSchema +
        'create table "tasks" ("id" primary key, "_changed", "_status", "author_id", "order", "created_at");' +
        'create index if not exists "tasks_author_id" on "tasks" ("author_id");' +
        'create index if not exists "tasks_order" on "tasks" ("order");' +
        'create index if not exists "tasks__status" on "tasks" ("_status");' +
        'create table "comments" ("id" primary key, "_changed", "_status", "is_ended", "reactions");' +
        'create index if not exists "comments__status" on "comments" ("_status");',
    )
  })
  it(`encodes schema with unsafe SQL`, () => {
    const testSchema2 = appSchema({
      version: 1,
      tables: [
        tableSchema({
          name: 'tasks',
          columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
          unsafeSql: (sql) => sql.replace(/create table "tasks" [^)]+\)/, '$& without rowid'),
        }),
      ],
      unsafeSql: (sql, kind) => {
        if (kind !== 'setup') {
          throw new Error('expected different unsafeSql kind')
        }
        return `create blabla;${sql}`
      },
    })

    expect(encodeSchema(testSchema2)).toBe(
      '' +
        'create blabla;' +
        expectedCommonSchema +
        'create table "tasks" ("id" primary key, "_changed", "_status", "author_id") without rowid;' +
        'create index if not exists "tasks_author_id" on "tasks" ("author_id");' +
        'create index if not exists "tasks__status" on "tasks" ("_status");',
    )
  })
})

describe('encodeIndices', () => {
  it(`encodes creation of indices`, () => {
    expect(encodeCreateIndices(testSchema)).toBe(
      '' +
        'create index if not exists "tasks_author_id" on "tasks" ("author_id");' +
        'create index if not exists "tasks_order" on "tasks" ("order");' +
        'create index if not exists "tasks__status" on "tasks" ("_status");' +
        'create index if not exists "comments__status" on "comments" ("_status");',
    )
  })
  it(`encodes removal of indices`, () => {
    expect(encodeDropIndices(testSchema)).toBe(
      '' +
        'drop index if exists "tasks_author_id";' +
        'drop index if exists "tasks_order";' +
        'drop index if exists "tasks__status";' +
        'drop index if exists "comments__status";',
    )
  })
  it(`encodes creation of indices with unsafe sql`, () => {
    const testSchema2 = {
      ...testSchema,
      unsafeSql: (sql, kind) => {
        if (kind !== 'create_indices') {
          throw new Error('expected different unsafeSql kind')
        }
        return sql + 'boop'
      },
    }
    expect(encodeCreateIndices(testSchema2)).toBe(
      '' +
        'create index if not exists "tasks_author_id" on "tasks" ("author_id");' +
        'create index if not exists "tasks_order" on "tasks" ("order");' +
        'create index if not exists "tasks__status" on "tasks" ("_status");' +
        'create index if not exists "comments__status" on "comments" ("_status");' +
        'boop',
    )
  })
  it(`encodes removal of indices with unsafe sql`, () => {
    const testSchema2 = {
      ...testSchema,
      unsafeSql: (sql, kind) => {
        if (kind !== 'drop_indices') {
          throw new Error('expected different unsafeSql kind')
        }
        return sql.replace(/drop/g, 'yeet')
      },
    }
    expect(encodeDropIndices(testSchema2)).toBe(
      '' +
        'yeet index if exists "tasks_author_id";' +
        'yeet index if exists "tasks_order";' +
        'yeet index if exists "tasks__status";' +
        'yeet index if exists "comments__status";',
    )
  })
})

describe('encodeMigrationSteps', () => {
  const migrationSchema = appSchema({
    version: 5,
    tables: [
      tableSchema({
        name: 'posts',
        columns: [
          { name: 'reactions', type: 'number' },
          { name: 'author_id', type: 'string', isIndexed: true },
          { name: 'is_pinned', type: 'boolean', isIndexed: true },
          { name: 'subtitle', type: 'string', isOptional: true },
        ],
      }),
      tableSchema({
        name: 'comments',
        columns: [
          { name: 'post_id', type: 'string', isIndexed: true },
          { name: 'description', type: 'string' },
        ],
      }),
      tableSchema({
        name: 'authors',
        columns: [
          { name: 'created_at', type: 'number' },
          { name: 'updated_at', type: 'number' },
        ],
      }),
    ],
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
      destroyColumn({
        table: 'posts',
        column: 'subtitle',
      }),
      renameColumn({
        table: 'comments',
        from: 'body',
        to: 'description',
      }),
    ]

    expect(encodeMigrationSteps(migrationSteps, migrationSchema)).toBe(
      '' +
        `alter table "posts" add "subtitle";` +
        `update "posts" set "subtitle" = null;` +
        `create table "comments" ("id" primary key, "_changed", "_status", "post_id", "body");` +
        `create index if not exists "comments_post_id" on "comments" ("post_id");` +
        `create index if not exists "comments__status" on "comments" ("_status");` +
        `alter table "posts" add "author_id";` +
        `update "posts" set "author_id" = '';` +
        `create index if not exists "posts_author_id" on "posts" ("author_id");` +
        `alter table "posts" add "is_pinned";` +
        `update "posts" set "is_pinned" = 0;` +
        `create index if not exists "posts_is_pinned" on "posts" ("is_pinned");` +
        // destroy column
        `create table "postsTemp" ("id" primary key, "_changed", "_status", "reactions", "author_id", "is_pinned", "subtitle");` +
        `create index if not exists "postsTemp_author_id" on "postsTemp" ("author_id");` +
        `create index if not exists "postsTemp_is_pinned" on "postsTemp" ("is_pinned");` +
        `create index if not exists "postsTemp__status" on "postsTemp" ("_status");` +
        `insert into "postsTemp" ("id", "_changed", "_status", "reactions", "author_id", "is_pinned") select "id", "_changed", "_status", "reactions", "author_id", "is_pinned" from "posts";` +
        `drop table "posts";` +
        `alter table "postsTemp" rename to "posts";` +
        // rename column
        `create table "commentsTemp" ("id" primary key, "_changed", "_status", "post_id", "description");` +
        `create index if not exists "commentsTemp_post_id" on "commentsTemp" ("post_id");` +
        `create index if not exists "commentsTemp__status" on "commentsTemp" ("_status");` +
        `insert into "commentsTemp" ("id", "_changed", "_status", "post_id", "description") select "id", "_changed", "_status", "post_id", "body" from "comments";` +
        `drop table "comments";` +
        `alter table "commentsTemp" rename to "comments";`,
    )
  })
  it(`encodes migrations with unsafe SQL`, () => {
    const migrationSteps = [
      addColumns({
        table: 'posts',
        columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
        unsafeSql: (sql) => `${sql}bla;`,
      }),
      createTable({
        name: 'comments',
        columns: [{ name: 'body', type: 'string' }],
        unsafeSql: (sql) => sql.replace(/create table [^)]+\)/, '$& without rowid'),
      }),
      unsafeExecuteSql('boop;'),
    ]

    expect(encodeMigrationSteps(migrationSteps)).toBe(
      '' +
        `alter table "posts" add "subtitle";` +
        `update "posts" set "subtitle" = null;` +
        'bla;' +
        `create table "comments" ("id" primary key, "_changed", "_status", "body") without rowid;` +
        `create index if not exists "comments__status" on "comments" ("_status");` +
        'boop;',
    )
  })
})
