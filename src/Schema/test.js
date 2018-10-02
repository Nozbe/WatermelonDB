import { appSchema, tableSchema } from './index'

describe('watermelondb/Schema', () => {
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
          columns: [{ name: 'col1', type: 'number' }],
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
        },
        bar: {
          name: 'bar',
          columns: { col1: { name: 'col1', type: 'number' } },
        },
      },
    })
  })
})
