import CollectionMap from './index'
import { mockDatabase, MockProject, MockTask } from '../../__tests__/testModels'
import Model from '../../Model'

describe('CollectionMap', () => {
  it('can initialize and get models', () => {
    const { db } = mockDatabase()
    const map = new CollectionMap(db, [MockProject, MockTask])

    expect(map.get('mock_projects').modelClass).toBe(MockProject)
    expect(map.get('mock_projects').table).toBe('mock_projects')
    expect(map.get('mock_tasks').modelClass).toBe(MockTask)
    expect(map.get('mock_tasks').table).toBe('mock_tasks')
  })
  it(`returns null for collections that don't exist`, () => {
    const { db } = mockDatabase()
    const map = new CollectionMap(db, [MockProject, MockTask])

    expect(map.get('mock_comments')).toBe(null)
    expect(map.get('does_not_exist')).toBe(null)
  })
  it(`returns null for naughty table names`, () => {
    const { db } = mockDatabase()
    const map = new CollectionMap(db, [MockProject, MockTask])

    expect(map.get(null)).toBe(null)
    expect(map.get(0)).toBe(null)
    expect(map.get(1)).toBe(null)
    expect(map.get('__proto__')).toBe(null)
    expect(map.get('hasOwnProperty')).toBe(null)
  })
  it(`collection map is immutable`, () => {
    const { db } = mockDatabase()
    const map = new CollectionMap(db, [MockProject, MockTask])
    expect(() => {
      map.map.foo = 'hey'
    }).toThrow()
  })
  it(`alerts the user of invalid model classes`, () => {
    const { db } = mockDatabase()
    class ModelWithMissingTable extends Model {}
    expect(() => new CollectionMap(db, [ModelWithMissingTable])).toThrow(
      /Model class ModelWithMissingTable passed to Database constructor is missing "static table = 'table_name'"/,
    )

    class ModelWithUnrecognizedTableName extends Model {
      static table = 'not_known_by_db'
    }
    expect(() => new CollectionMap(db, [ModelWithUnrecognizedTableName])).toThrow(
      /Model class ModelWithUnrecognizedTableName has static table defined that is missing in schema known by this database/,
    )
  })
})
