import { appSchema, tableSchema } from 'Schema'

import encodeSchema from '.'

const testSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'position', type: 'number', isOptional: true, isIndexed: true },
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
  'create table tasks (_changed, _status, id primary key, last_modified, author_id, position, created_at);' +
  'create index tasks_author_id on tasks (author_id);' +
  'create index tasks_position on tasks (position);' +
  'create index tasks__status on tasks (_status);' +
  'create table comments (_changed, _status, id primary key, last_modified, is_ended, reactions);' +
  'create index comments__status on comments (_status);'

describe('watermelondb/adapters/sqlite/encodeSchema', () => {
  it('encodes schema', () => {
    expect(encodeSchema(testSchema)).toEqual(expectedSchema)
  })
})
