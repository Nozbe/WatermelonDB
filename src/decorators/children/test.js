import { appSchema, tableSchema } from '../../Schema'
import * as Q from '../../QueryDescription'
import Model from '../../Model'
import Database from '../../Database'
import { field } from '..'
import { logger } from '../../utils/common'

import children from './index'

class MockParent extends Model {
  static table = 'mock_parent'

  static associations = {
    mock_child: { type: 'has_many', foreignKey: 'parent_id' },
  }

  @children('mock_child') children
}

class MockChild extends Model {
  static table = 'mock_child'

  static associations = {
    mock_parent: { type: 'belongs_to', key: 'parent_id' },
  }

  @field('parent_id') parentId
}

const makeDatabase = () =>
  new Database({
    adapter: {
      schema: appSchema({
        version: 1,
        tables: [
          tableSchema({ name: 'mock_parent', columns: [] }),
          tableSchema({ name: 'mock_child', columns: [{ name: 'parent_id', type: 'string' }] }),
        ],
      }),
    },

    modelClasses: [MockParent, MockChild],
  })

describe('decorators/children', () => {
  it('fetches children of a model', async () => {
    const database = makeDatabase()
    database.adapter.batch = jest.fn()

    const parentMock = await database.collections.get('mock_parent').create()

    const expectedQuery = database.collections
      .get('mock_child')
      .query(Q.where('parent_id', parentMock.id))
    expect(parentMock.children).toEqual(expectedQuery)
  })
  it('works on arbitrary objects with asModel', async () => {
    const database = makeDatabase()
    database.adapter.batch = jest.fn()

    const parent = await database.collections.get('mock_parent').create()
    class ParentProxy {
      asModel = parent

      @children('mock_child') children
    }
    const parentProxy = new ParentProxy()
    expect(parentProxy.children).toEqual(parent.children)
  })
  it('throws error if set is attempted', async () => {
    const database = makeDatabase()
    database.adapter.batch = jest.fn()

    const parent = await database.collections.get('mock_parent').create()

    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    parent.children = []
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('caches created Query', () => {
    const database = makeDatabase()
    const parent = new MockParent(database.collections.get('mock_parent'), {})

    const query1 = parent.children
    const query2 = parent.children
    expect(query1).toBe(query2)
  })
})
