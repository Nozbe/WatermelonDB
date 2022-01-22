import { appSchema, tableSchema } from '../../../Schema'
import { sanitizedRaw } from '../../../RawRecord'
import encodeBatch, {
  encodeInsertArgs,
  encodeInsertSql,
  encodeUpdateSql,
  encodeUpdateArgs,
  groupOperations,
} from './index'

const testSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'order', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'is_followed', type: 'boolean' },
      ],
    }),
  ],
})

const { tasks } = testSchema.tables
const sanitize = (raw) => sanitizedRaw(raw, tasks)

describe('encodeInsertSql', () => {
  it(`encodes insert for a table`, () => {
    expect(encodeInsertSql(tasks)).toBe(
      `insert into "tasks" ("id", "_status", "_changed", "author_id", "order", "created_at", "is_followed") values (?, ?, ?, ?, ?, ?, ?)`,
    )
  })
})

describe('encodeUpdateSql', () => {
  it(`encodes update for a table`, () => {
    expect(encodeUpdateSql(tasks)).toBe(
      `update "tasks" set "_status" = ?, "_changed" = ?, "author_id" = ?, "order" = ?, "created_at" = ?, "is_followed" = ? where "id" is ?`,
    )
  })
})

describe('encodeInsertArgs', () => {
  it(`encodes sql args for the insert query`, () => {
    expect(encodeInsertArgs(tasks, sanitize({ id: 'abcdef' }))).toEqual([
      'abcdef',
      'created',
      '',
      '',
      null,
      0,
      false,
    ])
    expect(
      encodeInsertArgs(
        tasks,
        sanitize({
          id: 'abcdef',
          _status: 'updated',
          _changed: 'order',
          author_id: 'a1',
          order: 3.14,
          created_at: 1234567890,
          is_followed: true,
        }),
      ),
    ).toEqual(['abcdef', 'updated', 'order', 'a1', 3.14, 1234567890, true])
  })
})

describe('encodeUpdateArgs', () => {
  it(`encodes sql args for the update query`, () => {
    expect(encodeUpdateArgs(tasks, sanitize({ id: 'abcdef' }))).toEqual([
      'created',
      '',
      '',
      null,
      0,
      false,
      'abcdef',
    ])
    expect(
      encodeUpdateArgs(
        tasks,
        sanitize({
          id: 'abcdef',
          _status: 'updated',
          _changed: 'order',
          author_id: 'a1',
          order: 3.14,
          created_at: 1234567890,
          is_followed: true,
        }),
      ),
    ).toEqual(['updated', 'order', 'a1', 3.14, 1234567890, true, 'abcdef'])
  })
})

describe('groupOperations', () => {
  it(`can group operations by type and table`, () => {
    expect(groupOperations([])).toEqual([])
    expect(
      groupOperations([
        ['create', 't1', 1],
        ['create', 't1', 2],
        ['create', 't1', 3],
      ]),
    ).toEqual([['create', 't1', [1, 2, 3]]])
    expect(
      groupOperations([
        ['create', 't1', 10],
        ['create', 't1', 11],
        ['create', 't2', 21],
        ['create', 't1', 12],
        ['update', 't1', 31],
        ['update', 't1', 32],
      ]),
    ).toEqual([
      ['create', 't1', [10, 11]],
      ['create', 't2', [21]],
      ['create', 't1', [12]],
      ['update', 't1', [31, 32]],
    ])
  })
})

describe('encodeBatch', () => {
  it(`can encode a native batch`, () => {
    expect(encodeBatch([], testSchema)).toEqual([])
    expect(
      encodeBatch(
        [
          ['create', 'tasks', sanitize({ id: 't1' })],
          ['create', 'tasks', sanitize({ id: 't2' })],
          ['update', 'tasks', sanitize({ id: 't3' })],
          ['markAsDeleted', 'tasks', 'foo'],
          ['destroyPermanently', 'tasks', 'bar'],
          ['destroyPermanently', 'tasks', 'baz'],
        ],
        testSchema,
      ),
    ).toEqual([
      [
        1,
        'tasks',
        encodeInsertSql(tasks),
        [
          encodeInsertArgs(tasks, sanitize({ id: 't1' })),
          encodeInsertArgs(tasks, sanitize({ id: 't2' })),
        ],
      ],
      [0, null, encodeUpdateSql(tasks), [encodeUpdateArgs(tasks, sanitize({ id: 't3' }))]],
      [-1, 'tasks', `update "tasks" set "_status" = 'deleted' where "id" == ?`, [['foo']]],
      [-1, 'tasks', `delete from "tasks" where "id" == ?`, [['bar'], ['baz']]],
    ])
  })
  it(`can recreate indices for large batches`, () => {
    expect(encodeBatch(Array(1000).fill(['markAsDeleted', 'tasks', 'foo']), testSchema)).toEqual([
      [0, null, 'drop index "tasks_author_id"', [[]]],
      [0, null, 'drop index "tasks__status"', [[]]],
      [
        -1,
        'tasks',
        `update "tasks" set "_status" = 'deleted' where "id" == ?`,
        Array(1000).fill(['foo']),
      ],
      [0, null, 'create index "tasks_author_id" on "tasks" ("author_id")', [[]]],
      [0, null, 'create index "tasks__status" on "tasks" ("_status")', [[]]],
    ])
  })
})
