import { createTable, addColumn, schemaMigrations } from './index'

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
          ],
        },
        {
          from: 1,
          to: 2,
          steps: [
            addColumn({
              table: 'posts',
              column: { name: 'subtitle', type: 'string', isOptional: true },
            }),
            addColumn({
              table: 'posts',
              column: { name: 'author_id', type: 'string', isIndexed: true },
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
          ],
        },
        {
          from: 1,
          to: 2,
          steps: [
            {
              type: 'add_column',
              table: 'posts',
              column: { name: 'subtitle', type: 'string', isOptional: true },
            },
            {
              type: 'add_column',
              table: 'posts',
              column: { name: 'author_id', type: 'string', isIndexed: true },
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
  it('throws if addColumn() is malformed', () => {
    expect(() => addColumn({ column: {} })).toThrow(/table/)
    expect(() => addColumn({ table: 'foo', column: { name: 'x', type: 'blah' } })).toThrow(/type/)
  })
})
