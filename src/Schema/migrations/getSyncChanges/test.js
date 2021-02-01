import getSyncChanges from './index'
import { schemaMigrations, createTable, addColumns, unsafeExecuteSql } from '../index'

const createCommentsTable = createTable({
  name: 'comments',
  columns: [{ name: 'post_id', type: 'string', isIndexed: true }, { name: 'body', type: 'string' }],
})

const test = (migrations, from, to) => getSyncChanges(schemaMigrations({ migrations }), from, to)
const testSteps = steps =>
  getSyncChanges(schemaMigrations({ migrations: [{ toVersion: 2, steps }] }), 1, 2)

describe('getSyncChanges', () => {
  it('returns null for from==to', () => {
    expect(test([{ toVersion: 2, steps: [createCommentsTable] }], 2, 2)).toEqual(null)
  })
  it('returns empty changes for empty steps', () => {
    expect(testSteps([])).toEqual({ from: 1, tables: [], columns: [] })
  })
  it('returns created tables', () => {
    expect(testSteps([createCommentsTable])).toEqual({ from: 1, tables: ['comments'], columns: [] })
  })
  it('returns added columns', () => {
    expect(
      testSteps([
        addColumns({
          table: 'posts',
          columns: [
            { name: 'subtitle', type: 'string', isOptional: true },
            { name: 'is_pinned', type: 'boolean' },
          ],
        }),
      ]),
    ).toEqual({
      from: 1,
      tables: [],
      columns: [{ table: 'posts', columns: ['subtitle', 'is_pinned'] }],
    })
  })
  it('combines added columns from multiple migration steps', () => {
    expect(
      testSteps([
        addColumns({
          table: 'posts',
          columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'posts',
          columns: [{ name: 'is_pinned', type: 'boolean' }],
        }),
        addColumns({
          table: 'posts',
          columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
        }),
      ]),
    ).toEqual({
      from: 1,
      tables: [],
      columns: [{ table: 'posts', columns: ['subtitle', 'is_pinned', 'author_id'] }],
    })
  })
  it('skips added columns for a table if it is also added', () => {
    expect(
      testSteps([
        createCommentsTable,
        addColumns({
          table: 'comments',
          columns: [{ name: 'reactions', type: 'string', isOptional: true }],
        }),
      ]),
    ).toEqual({
      from: 1,
      tables: ['comments'],
      columns: [],
    })
  })
  it('skips duplicates', () => {
    // technically, a duplicate createTable or addColumn would crash
    // but this is in case future migration types could do something like it
    expect(
      testSteps([
        createCommentsTable,
        createCommentsTable,
        addColumns({
          table: 'posts',
          columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'posts',
          columns: [{ name: 'subtitle', type: 'string', isOptional: true }],
        }),
      ]),
    ).toEqual({
      from: 1,
      tables: ['comments'],
      columns: [{ table: 'posts', columns: ['subtitle'] }],
    })
  })
  const bigMigrations = [
    {
      toVersion: 10,
      steps: [
        // No changes
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'attachment_versions',
          columns: [{ name: 'reactions', type: 'string' }],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'workspaces',
          columns: [
            { name: 'plan_info', type: 'string', isOptional: true },
            { name: 'limits', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        createTable({
          name: 'attachments',
          columns: [{ name: 'parent_id', type: 'string', isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'attachment_versions',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'size', type: 'number' },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'mime_type', type: 'string' },
            { name: 'attachment_id', type: 'string', isIndexed: true },
            { name: 'author_id', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
          unsafeSql: sql => sql,
        }),
        unsafeExecuteSql(''),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'comments',
          columns: [{ name: 'is_pinned', type: 'boolean' }, { name: 'extra', type: 'string' }],
        }),
        addColumns({ table: 'projects', columns: [{ name: 'extra', type: 'string' }] }),
      ],
    },
    { toVersion: 4, steps: [] },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'task_recurrences',
          columns: [{ name: 'project_id', type: 'string' }],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'projects',
          columns: [{ name: 'preferences', type: 'string', isOptional: true }],
        }),
      ],
    },
  ]
  it('can handle a complex migration steps list', () => {
    expect(test(bigMigrations, 1, 10)).toEqual({
      from: 1,
      tables: ['attachment_versions', 'attachments'],
      columns: [
        { table: 'projects', columns: ['preferences', 'extra'] },
        { table: 'task_recurrences', columns: ['project_id'] },
        { table: 'comments', columns: ['is_pinned', 'extra'] },
        { table: 'workspaces', columns: ['plan_info', 'limits'] },
      ],
    })
  })
  it(`returns only the necessary range of migrations`, () => {
    expect(test(bigMigrations, 6, 10)).toEqual({
      from: 6,
      tables: ['attachments'],
      columns: [
        { table: 'workspaces', columns: ['plan_info', 'limits'] },
        { table: 'attachment_versions', columns: ['reactions'] },
      ],
    })
    expect(test(bigMigrations, 8, 10)).toEqual({
      from: 8,
      tables: [],
      columns: [{ table: 'attachment_versions', columns: ['reactions'] }],
    })
    expect(test(bigMigrations, 9, 10)).toEqual({ from: 9, tables: [], columns: [] })
    expect(test(bigMigrations, 10, 10)).toEqual(null)
  })
  it(`fails on incorrect migrations`, () => {
    expect(() => test(bigMigrations, 0, 9)).toThrow()
    expect(() => test(bigMigrations, 8, 11)).toThrow()
  })
  it('fails early on unknown migration steps', () => {
    const possibleFutureTypes = [
      'broken',
      'rename_table',
      'rename_column',
      'add_column_index',
      'make_column_optional',
      'make_column_required',
      'destroy_table',
      'destroy_column',
    ]
    possibleFutureTypes.forEach(type => {
      expect(() => testSteps([{ type }])).toThrow(/Unknown migration step type/)
    })
    expect(() => testSteps([{ type: undefined }])).toThrow(/Invalid migration steps/)
  })
})
