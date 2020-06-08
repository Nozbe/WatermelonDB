import getSyncChanges from './index'
import { createTable, addColumns } from '../index'

const createCommentsTable = createTable({
  name: 'comments',
  columns: [{ name: 'post_id', type: 'string', isIndexed: true }, { name: 'body', type: 'string' }],
})

describe('getSyncChanges', () => {
  it('returns empty changes for empty steps', () => {
    expect(getSyncChanges([])).toEqual({ tables: [], columns: [] })
  })
  it('returns created tables', () => {
    expect(getSyncChanges([createCommentsTable])).toEqual({
      tables: ['comments'],
      columns: [],
    })
  })
  it('returns added columns', () => {
    expect(
      getSyncChanges([
        addColumns({
          table: 'posts',
          columns: [
            { name: 'subtitle', type: 'string', isOptional: true },
            { name: 'is_pinned', type: 'boolean' },
          ],
        }),
      ]),
    ).toEqual({
      tables: [],
      columns: [{ table: 'posts', columns: ['subtitle', 'is_pinned'] }],
    })
  })
  it('combines added columns from multiple migration steps', () => {
    expect(
      getSyncChanges([
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
      tables: [],
      columns: [{ table: 'posts', columns: ['subtitle', 'is_pinned', 'author_id'] }],
    })
  })
  it('skips added columns for a table if it is also added', () => {
    expect(
      getSyncChanges([
        createCommentsTable,
        addColumns({
          table: 'comments',
          columns: [{ name: 'reactions', type: 'string', isOptional: true }],
        }),
      ]),
    ).toEqual({ tables: ['comments'], columns: [] })
  })
  it('skips duplicates', () => {
    // technically, a duplicate createTable or addColumn would crash
    // but this is in case future migration types could do something like it
    expect(
      getSyncChanges([
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
      tables: ['comments'],
      columns: [{ table: 'posts', columns: ['subtitle'] }],
    })
  })
  it('can handle a complex migration steps list', () => {
    expect(
      getSyncChanges([
        addColumns({
          table: 'attachment_versions',
          columns: [{ name: 'reactions', type: 'string' }],
        }),
        addColumns({
          table: 'workspaces',
          columns: [
            { name: 'plan_info', type: 'string', isOptional: true },
            { name: 'limits', type: 'string' },
          ],
        }),
        createTable({
          name: 'attachments',
          columns: [{ name: 'parent_id', type: 'string', isIndexed: true }],
        }),
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
        }),
        addColumns({
          table: 'comments',
          columns: [{ name: 'is_pinned', type: 'boolean' }, { name: 'extra', type: 'string' }],
        }),
        addColumns({
          table: 'projects',
          columns: [{ name: 'extra', type: 'string' }],
        }),
        addColumns({
          table: 'task_recurrences',
          columns: [{ name: 'project_id', type: 'string' }],
        }),
        addColumns({
          table: 'projects',
          columns: [{ name: 'preferences', type: 'string', isOptional: true }],
        }),
      ]),
    ).toEqual({
      tables: ['attachments', 'attachment_versions'],
      columns: [
        { table: 'workspaces', columns: ['plan_info', 'limits'] },
        { table: 'comments', columns: ['is_pinned', 'extra'] },
        { table: 'projects', columns: ['extra', 'preferences'] },
        { table: 'task_recurrences', columns: ['project_id'] },
      ],
    })
  })
  it('fails early on unknown migration steps', () => {
    const possibleFutureTypes = [
      'broken',
      undefined,
      'rename_table',
      'rename_column',
      'add_column_index',
      'make_column_optional',
      'make_column_required',
      'destroy_table',
      'destroy_column',
    ]
    possibleFutureTypes.forEach(type => {
      expect(() => getSyncChanges([{ type }])).toThrow(/Unknown migration step type/)
    })
  })
})
