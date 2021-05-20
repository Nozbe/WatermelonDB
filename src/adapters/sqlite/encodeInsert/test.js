import { appSchema, tableSchema } from '../../../Schema'
import { sanitizedRaw } from '../../../RawRecord'
import encodeInsert from './index'

const testSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'author_id', type: 'string' },
        { name: 'order', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'is_followed', type: 'boolean' },
      ],
    }),
  ],
})

const { tasks } = testSchema.tables
const encode = (schema, dirtyRaw) => encodeInsert(schema, sanitizedRaw(dirtyRaw, schema))

describe('SQLite encodeInsert', () => {
  it(`encodes record inserts`, () => {
    const expectedInsertSql = `insert into "tasks" ("id", "_status", "_changed", "author_id", "order", "created_at", "is_followed") values (?, ?, ?, ?, ?, ?, ?)`
    expect(encode(tasks, { id: 'abcdef' })).toEqual([
      expectedInsertSql,
      ['abcdef', 'created', '', '', null, 0, false],
    ])
    expect(
      encode(tasks, {
        id: 'abcdef',
        _status: 'updated',
        _changed: 'order',
        author_id: 'a1',
        order: 3.14,
        created_at: 1234567890,
        is_followed: true,
      }),
    ).toEqual([expectedInsertSql, ['abcdef', 'updated', 'order', 'a1', 3.14, 1234567890, true]])
    // query stays consistent - it's derived from schema, not query
    expect(encodeInsert(tasks, {})[0]).toBe(expectedInsertSql)
  })
})
