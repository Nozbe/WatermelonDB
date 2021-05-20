import { appSchema, tableSchema } from '../../../Schema'
import { sanitizedRaw } from '../../../RawRecord'
import encodeUpdate from './index'

// TODO: Deduplicate with encodeInsert
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
const encode = (schema, dirtyRaw) => encodeUpdate(schema, sanitizedRaw(dirtyRaw, schema))

describe('SQLite encodeUpdate', () => {
  it('encodes model updates', () => {
    const expectedInsertSql = `update "tasks" set "_status" = ?, "_changed" = ?, "author_id" = ?, "order" = ?, "created_at" = ?, "is_followed" = ? where "id" is ?`
    expect(encode(tasks, { id: 'abcdef' })).toEqual([
      expectedInsertSql,
      ['created', '', '', null, 0, false, 'abcdef'],
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
    ).toEqual([expectedInsertSql, ['updated', 'order', 'a1', 3.14, 1234567890, true, 'abcdef']])
    // query stays consistent - it's derived from schema, not query
    expect(encodeUpdate(tasks, {})[0]).toBe(expectedInsertSql)
  })
})
