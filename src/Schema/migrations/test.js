import { createTable, addColumns, schemaMigrations } from './index'
import { stepsForMigration } from './helpers'

describe('schemaMigrations()', () => {
  it('returns a basic schema migrations spec', () => {
    const migrations = schemaMigrations({
      minimumVersion: 1,
      currentVersion: 1,
      migrations: [],
    })
    expect(migrations).toEqual({
      minimumVersion: 1,
      currentVersion: 1,
      migrations: [],
      validated: true,
    })
  })
  it('returns a complex schema migrations spec', () => {
    const migrations = schemaMigrations({
      minimumVersion: 1,
      currentVersion: 5,
      migrations: [
        { from: 4, to: 5, steps: [] },
        {
          from: 2,
          to: 4,
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
          from: 1,
          to: 2,
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
      minimumVersion: 1,
      currentVersion: 5,
      migrations: [
        { from: 4, to: 5, steps: [] },
        {
          from: 2,
          to: 4,
          steps: [
            {
              type: 'create_table',
              name: 'comments',
              columns: {
                post_id: { name: 'post_id', type: 'string', isIndexed: true },
                body: { name: 'body', type: 'string' },
              },
            },
            {
              type: 'add_columns',
              table: 'posts',
              columns: [{ name: 'author_id', type: 'string', isIndexed: true }],
            },
          ],
        },
        {
          from: 1,
          to: 2,
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
      ],
    })
  })
  it('throws if migration spec is malformed', () => {
    expect(() =>
      schemaMigrations({
        currentVersion: 1,
        migrations: [],
      }),
    ).toThrow(/minimum schema version/i)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        migrations: [],
      }),
    ).toThrow(/current schema version/i)
    expect(() =>
      schemaMigrations({
        minimumVersion: 0,
        currentVersion: 1,
        migrations: [],
      }),
    ).toThrow(/at least 1/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 2,
        currentVersion: 1,
        migrations: [],
      }),
    ).toThrow(/greater than/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 1,
        migrations: [{}],
      }),
    ).toThrow(/Invalid migration/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 1,
        migrations: [{ from: 1, to: 1 }],
      }),
    ).toThrow(/greater than/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 2,
        migrations: [{ from: 1, to: 2, steps: [{ table: 'x' }] }],
      }),
    ).toThrow(/Invalid migration steps/)
  })
  it(`throws if migrations don't cover the whole migrable range`, () => {
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 3,
        migrations: [{ from: 2, to: 3, steps: [] }],
      }),
    ).toThrow(/covers schema versions/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 3,
        migrations: [{ from: 1, to: 2, steps: [] }],
      }),
    ).toThrow(/cover schema versions/)
    expect(() =>
      schemaMigrations({
        minimumVersion: 1,
        currentVersion: 4,
        migrations: [{ from: 1, to: 2, steps: [] }, { from: 2, to: 3, steps: [] }],
      }),
    ).toThrow(/covers schema versions/)
  })
})

describe('migration step functions', () => {
  it('throws if createTable() is malformed', () => {
    expect(() => createTable({ columns: [] })).toThrow(/name/)
    expect(() => createTable({ name: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      /type/,
    )
  })
  it('throws if addColumns() is malformed', () => {
    expect(() => addColumns({ columns: [{}] })).toThrow(/table/)
    expect(() => addColumns({ table: 'foo' })).toThrow(/columns/)
    expect(() => addColumns({ table: 'foo', columns: { name: 'x', type: 'blah' } })).toThrow(
      /columns/,
    )
    expect(() => addColumns({ table: 'foo', columns: [{ name: 'x', type: 'blah' }] })).toThrow(
      /type/,
    )
  })
})

describe('migration execution helpers', () => {
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
      minimumVersion: 1,
      currentVersion: 5,
      migrations: [
        { from: 4, to: 5, steps: [step2, step3] },
        { from: 2, to: 4, steps: [] },
        { from: 1, to: 2, steps: [step1] },
      ],
    })

    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 4 })).toEqual([step1])
    expect(stepsForMigration({ migrations, fromVersion: 1, toVersion: 5 })).toEqual([
      step1,
      step2,
      step3,
    ])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 5 })).toEqual([step2, step3])
    expect(stepsForMigration({ migrations, fromVersion: 2, toVersion: 4 })).toEqual([])
    expect(stepsForMigration({ migrations, fromVersion: 4, toVersion: 5 })).toEqual([step2, step3])
  })
})
