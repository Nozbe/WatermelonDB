import { appSchema, tableSchema } from './index'

describe('Schema', () => {
  it('can prepare schema', () => {
    const testSchema = appSchema({
      version: 1,
      tables: [
        tableSchema({
          name: 'foo',
          columns: [{ name: 'col1', type: 'string' }, { name: 'col2', type: 'number' }],
        }),
        tableSchema({
          name: 'bar',
          columns: [
            { name: 'col1', type: 'number' },
            { name: 'col2', type: 'boolean' },
            { name: 'col3', type: 'boolean' },
          ],
        }),
      ],
    })

    expect(testSchema).toEqual({
      version: 1,
      tables: {
        foo: {
          name: 'foo',
          columns: {
            col1: { name: 'col1', type: 'string' },
            col2: { name: 'col2', type: 'number' },
          },
          columnArray: [{ name: 'col1', type: 'string' }, { name: 'col2', type: 'number' }],
        },
        bar: {
          name: 'bar',
          columns: {
            col1: { name: 'col1', type: 'number' },
            col2: { name: 'col2', type: 'boolean' },
            col3: { name: 'col3', type: 'boolean' },
          },
          columnArray: [
            { name: 'col1', type: 'number' },
            { name: 'col2', type: 'boolean' },
            { name: 'col3', type: 'boolean' },
          ],
        },
      },
    })
  })
  it('can define last_modified in user land', () => {
    expect(() =>
      tableSchema({
        name: 'foo',
        columns: [{ name: 'last_modified', type: 'number', isOptional: true }],
      }),
    ).not.toThrow()
    expect(() =>
      tableSchema({
        name: 'foo',
        columns: [{ name: 'last_modified', type: 'number' }],
      }),
    ).not.toThrow()
    expect(() =>
      tableSchema({
        name: 'foo',
        columns: [{ name: 'last_modified', type: 'string' }],
      }),
    ).toThrow(/last_modified must be.*number/)
  })
})
