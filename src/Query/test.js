import Model from '../Model'
import * as Q from '../QueryDescription'

import Query from './index'

class MockTaskModel extends Model {
  static table = 'mock_tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}

const mockCollection = Object.freeze({ modelClass: MockTaskModel })

describe('Query', () => {
  it('fetches tables correctly for simple queries', () => {
    const query = new Query(mockCollection, [Q.where('id', 'abcdef')])
    expect(query.table).toBe('mock_tasks')
    expect(query.secondaryTables).toEqual([])
    expect(query.allTables).toEqual(['mock_tasks'])
  })
  it('fetches tables correctly for complex queries', () => {
    const query = new Query(mockCollection, [
      Q.where('id', 'abcdef'),
      Q.on('projects', 'team_id', 'abcdef'),
    ])
    expect(query.table).toBe('mock_tasks')
    expect(query.secondaryTables).toEqual(['projects'])
    expect(query.allTables).toEqual(['mock_tasks', 'projects'])
  })
  it('fetches associations correctly for simple queries', () => {
    const query = new Query(mockCollection, [Q.where('id', 'abcdef')])
    expect(query.hasJoins).toBe(false)
    expect(query.associations).toEqual([])
  })
  it('fetches associations correctly for complex queries', () => {
    const query = new Query(mockCollection, [
      Q.where('id', 'abcdef'),
      Q.on('projects', 'team_id', 'abcdef'),
    ])
    expect(query.hasJoins).toBe(true)
    expect(query.associations).toEqual([['projects', { type: 'belongs_to', key: 'project_id' }]])
  })
  it('fetches associations correctly for more complex queries', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
    ])
    expect(query.hasJoins).toBe(true)
    expect(query.secondaryTables).toEqual(['projects', 'tag_assignments'])
    expect(query.associations).toEqual([
      ['projects', { type: 'belongs_to', key: 'project_id' }],
      ['tag_assignments', { type: 'has_many', foreignKey: 'task_id' }],
    ])
  })
  it('can return extended query', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
    ])
    const extendedQuery = query.extend(
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      Q.where('id', 'abcdef'),
    )
    const expectedQuery = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      Q.where('id', 'abcdef'),
    ])
    expect(extendedQuery.collection).toBe(expectedQuery.collection)
    expect(extendedQuery.modelClass).toBe(expectedQuery.modelClass)
    expect(extendedQuery.description).toEqual(expectedQuery.description)
    expect(extendedQuery.secondaryTables).toEqual(expectedQuery.secondaryTables)
    expect(extendedQuery.associations).toEqual(expectedQuery.associations)
    expect(extendedQuery.hasJoins).toBe(expectedQuery.hasJoins)
    expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
  })
  it('returns serializable version of Query', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
    ])
    expect(query.serialize()).toEqual({
      table: 'mock_tasks',
      description: query.description,
      associations: query.associations,
    })
  })
  it('can return double extended query', () => {
    const query = new Query(mockCollection, [Q.on('projects', 'team_id', 'abcdef')])
    const extendedQuery = query
      .extend(
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.where('left_column', 'right_value'),
      )
      .extend(Q.on('projects', 'team_id', 'abcdefg'), Q.where('id', 'abcdef'))
    const expectedQuery = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      Q.where('left_column', 'right_value'),
      Q.on('projects', 'team_id', 'abcdefg'),
      Q.where('id', 'abcdef'),
    ])
    expect(extendedQuery.collection).toBe(expectedQuery.collection)
    expect(extendedQuery.modelClass).toBe(expectedQuery.modelClass)
    expect(extendedQuery.description).toEqual(expectedQuery.description)
    expect(extendedQuery.secondaryTables).toEqual(expectedQuery.secondaryTables)
    expect(extendedQuery.associations).toEqual(expectedQuery.associations)
    expect(extendedQuery.hasJoins).toBe(expectedQuery.hasJoins)
    expect(extendedQuery._rawDescription).toEqual(expectedQuery._rawDescription)
  })
})
