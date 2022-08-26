import { createTable, addColumns, schemaMigrations } from './index'
import { stepsForMigration } from './stepsForMigration'

describe('schemaMigrations()', () => {
  it('returns a basic schema migrations spec', () => {
    const migrations = schemaMigrations({ migrations: [] })
    expect(migrations).toEqual({
      sortedMigrations: [],
      validated: true,
      minVersion: 1,
      maxVersion: 1,
    })

    const migrations2 = schemaMigrations({ migrations: [{ toVersion: 2, steps: [] }] })
    expect(migrations2).toEqual({
      validated: true,
      minVersion: 1,
      maxVersion: 2,
      sortedMigrations: [{ toVersion: 2, steps: [] }],
    })

    const migrations3 = schemaMigrations({ migrations: [{ toVersion: 4, steps: [] }] })
    expect(migrations3).toEqual({
      validated: true,
      minVersion: 3,
      maxVersion: 4,
      sortedMigrations: [{ toVersion: 4, steps: [] }],
    })
  })
  it('returns a complex schema migrations spec', () => {
    const migrations = schemaMigrations({
      migrations: [
        { toVersion: 4, steps: [] },
        {
          toVersion: 3,
          steps: [
            createTable({
              name: 'comments',
              columns: [
                { name: 'post_id', type: 'string', isIndexed: true },
                { name: 'body', type: 'string' },
              ],
            }),
            addColumns({
              table: 'posts',
              columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
            }),
          ],
        },
        {
          toVersion: 2,
          steps: [
            addColumns({
              table: 'posts',
              columns: [
                { name: 'subtitle', type: 'string', isOptional: true },
                { name: 'is_pinned', type: 'boolean' },
              ],
            }),
          ],
        },
      ],
    })
    expect(migrations).toEqual({
      validated: true,
      minVersion: 1,
      maxVersion: 4,
      sortedMigrations: [
        {
          toVersion: 2,
          steps: [
            {
              type: 'add_columns',
              table: 'posts',
              columns: [
                { name: 'subtitle', type: 'string', isOptional: true },
                { name: 'is_pinned', type: 'boolean' },
              ],
            },
          ],
        },
        {
          toVersion: 3,
          steps: [
            {
              type: 'create_table',
              schema: {
                name: 'comments',
                columns: {
                  post_id: { name: 'post_id', type: 'string', isIndexed: true },
                  body: { name: 'body', type: 'string' },
                },
                columnArray: [
                  { name: 'post_id', type: 'string', isIndexed: true },
                  { name: 'body', type: 'string' },
                ],
              },
            },
            {
              type: 'add_columns',
              table: 'posts',
              columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
            },
          ],
        },
        { toVersion: 4, steps: [] },
      ],
    })
  })
  it('throws if migration spec is malformed', () => {
    expect(() => schemaMigrations({ migrations: [{}] })).toThrow('Invalid migration')
    expect(() => schemaMigrations({ migrations: [{ toVersion: 0, steps: [] }] })).toThrow(
      /minimum.*is 2/i,
    )
    expect(() => schemaMigrations({ migrations: [{ toVersion: 1, steps: [] }] })).toThrow(
      /minimum.*is 2/i,
    )
    expect(() =>
      schemaMigrations({
        migrations: [{ toVersion: 2, steps: [{ table: 'x' }] }],
      }),
    ).toThrow('Invalid migration steps')
  })
  it(`throws if there are gaps or duplicates in migrations`, () => {
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 2, steps: [] },
          { toVersion: 2, steps: [] },
        ],
      }),
    ).toThrow('duplicates')
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 5, steps: [] },
          { toVersion: 4, steps: [] },
          { toVersion: 2, steps: [] },
        ],
      }),
    ).toThrow('gaps')

    // missing migrations from 2 to x are ok
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 6, steps: [] },
          { toVersion: 5, steps: [] },
          { toVersion: 4, steps: [] },
        ],
      }),
    ).not.toThrow()

    // chronological is ok too
    expect(() =>
      schemaMigrations({
        migrations: [
          { toVersion: 4, steps: [] },
          { toVersion: 5, steps: [] },
          { toVersion: 6, steps: [] },
        ],
      }),
    ).not.toThrow()
  })
})

describe('migration step functions', () => {
  it('throws if createTable() is malformed', () => {
    expect(() => createTable({ columns: [] })).toThrow('name')
    expect(() => createTable({ name: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      'type',
    )
  })
  it('throws if addColumns() is malformed', () => {
    expect(() => addColumns({ columns: [{}] })).toThrow('table')
    expect(() => addColumns({ table: 'foo' })).toThrow('columns')
    expect(() => addColumns({ table: 'foo', columns: { name: 'x', type: 'blah' } })).toThrow(
      'columns',
    )
    expect(() => addColumns({ table: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      'type',
    )
  })
})

describe('stepsForMigration', () => {
  it('finds the right migration steps', () => {
    const step1 = addColumns({
      table: 'posts',
      columns: [
        { name: 'subtitle', type: 'string', isOptional: true },
        { name: 'is_pinned', type: 'boolean' },
      ],
    })
    const step2 = addColumns({
      table: 'posts',
      columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
    })
    const step3 = createTable({
      name: 'comments',
      columns: [
        { name: 'post_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string' },
      ],
    })

    const migrations = schemaMigrations({
      migrations: [
        { toVersion: 5, steps: [step2, step3] },
        { toVersion: 4, steps: [] },
        { toVersion: 3, steps: [step1] },
      ],
    })

    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 3 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 4 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 5 })).toEqual([
      step1,
      step2,
      step3,
    ])
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 5 })).toEqual([step2, step3])
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 4 })).toEqual([])
    expect(stepsForMigration({ migrations, fromVersion: 4, toVersion: 5 })).toEqual([step2, step3])

    // if no available steps, return null
    expect(
      stepsForMigration({
        migrations: schemaMigrations({ migrations: [] }),
        fromVersion: 1,
        toVersion: 2,
      }),
    ).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 3 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 5 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 3, toVersion: 6 })).toEqual(null)
    expect(stepsForMigration({ migrations, fromVersion: 5, toVersion: 6 })).toEqual(null)
  })
})
