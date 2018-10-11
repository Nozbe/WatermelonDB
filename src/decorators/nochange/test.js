import { expectToRejectWithMessage } from '../../__tests__/utils'
import { appSchema, tableSchema } from '../../Schema'

import Database from '../../Database'
import Model from '../../Model'
import field from '../field'

import nochange from './index'

class MockModel extends Model {
  static table = 'mock'

  @nochange
  @field('foo')
  foo
}

const makeDatabase = () =>
  new Database({
    adapter: {
      schema: appSchema({
        version: 1,
        tables: [
          tableSchema({
            name: 'mock',
            columns: [{ name: 'foo', type: 'string', isOptional: true }],
          }),
        ],
      }),
    },
    modelClasses: [MockModel],
  })

describe('watermelondb/decorators/nochange', () => {
  it('allows setting values in create()', async () => {
    const database = makeDatabase()
    database.adapter.batch = jest.fn()

    const model = await database.collections.get('mock').create(mock => {
      expect(mock.foo).toBe(null)
      mock.foo = 't1'
      expect(mock.foo).toBe('t1')
      mock.foo = 't2'
      expect(mock.foo).toBe('t2')
      mock.foo = null
      expect(mock.foo).toBe(null)
      mock.foo = 't3'
    })

    expect(model.foo).toBe('t3')
  })
  it('allows setting value in prepareCreate', () => {
    const database = makeDatabase()
    const model = database.collections.get('mock').prepareCreate(mock => {
      mock.foo = 't1'
      mock.foo = 't2'
    })
    expect(model.foo).toBe('t2')
  })
  it('throws error if change after create is attempted', async () => {
    const database = makeDatabase()
    database.adapter.batch = jest.fn()

    const model = await database.collections.get('mock').create(mock => {
      mock.foo = 't1'
    })

    await expectToRejectWithMessage(
      model.update(mock => {
        mock.foo = 't2'
      }),
      /set a new value/,
    )
    expect(model.foo).toBe('t1')
  })
  it('fails if applied to incorrect fields', () => {
    expect(
      () =>
        class {
          @nochange
          simpleField
        },
    ).toThrow()
  })
})
