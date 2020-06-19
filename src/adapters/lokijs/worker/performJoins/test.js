import performJoins from './index'
import encodeQuery from '../encodeQuery'
import Query from '../../../../Query'
import Model from '../../../../Model'
import * as Q from '../../../../QueryDescription'

class MockTask extends Model {
  static table = 'tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}

const mockCollection = Object.freeze({ modelClass: MockTask })

const testQuery = (query, performer) => performJoins(encodeQuery(query.serialize()), performer)

describe('performJoins', () => {
  it(`returns simple queries as is`, () => {
    const query = new Query(mockCollection, [Q.where('col', 'hello')])
    const performer = jest.fn()
    expect(testQuery(query, performer)).toEqual({
      $and: [{ col: { $eq: 'hello' } }, { _status: { $ne: 'deleted' } }],
    })
    expect(performer).toHaveBeenCalledTimes(0)
  })
  const makePerformer = () =>
    jest.fn(({ table }) => {
      if (table === 'projects') {
        return [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
      } else if (table === 'tag_assignments') {
        return [{ task_id: 't1' }, { task_id: 't2' }]
      }
      return []
    })
  it(`performs JOIN queries`, () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      Q.on('projects', 'is_active', true),
    ])
    const performer = makePerformer()
    expect(testQuery(query, performer)).toEqual({
      $and: [
        { project_id: { $in: ['p1', 'p2', 'p3'] } },
        { id: { $in: ['t1', 't2'] } },
        { left_column: { $eq: 'right_value' } },
        { _status: { $ne: 'deleted' } },
      ],
    })
    expect(performer).toHaveBeenCalledTimes(2)
    expect(performer).toHaveBeenCalledWith({
      table: 'projects',
      query: {
        $and: [
          { team_id: { $eq: 'abcdef' } },
          { is_active: { $aeq: true } },
          { _status: { $ne: 'deleted' } },
        ],
      },
      originalConditions: [
        Q.where('team_id', 'abcdef'),
        Q.where('is_active', true),
        Q.where('_status', Q.notEq('deleted')),
      ],
      mapKey: 'id',
      joinKey: 'project_id',
    })
    expect(performer).toHaveBeenCalledWith({
      table: 'tag_assignments',
      query: {
        $and: [{ tag_id: { $in: ['a', 'b', 'c'] } }, { _status: { $ne: 'deleted' } }],
      },
      originalConditions: [
        Q.where('tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.where('_status', Q.notEq('deleted')),
      ],
      mapKey: 'task_id',
      joinKey: 'id',
    })
  })
  it(`performs on()s nested inside AND/ORs`, () => {
    const query = new Query(mockCollection, [
      Q.experimentalJoinTables(['projects', 'tag_assignments']),
      Q.or(
        Q.where('is_followed', true),
        Q.on('projects', 'is_followed', true),
        Q.and(Q.on('tag_assignments', 'foo', 'bar')),
      ),
    ])
    const performer = makePerformer()
    expect(testQuery(query, performer)).toEqual({
      $and: [
        {
          $or: [
            { is_followed: { $aeq: true } },
            { project_id: { $in: ['p1', 'p2', 'p3'] } },
            { id: { $in: ['t1', 't2'] } },
          ],
        },
        { _status: { $ne: 'deleted' } },
      ],
    })
    expect(performer).toHaveBeenCalledTimes(2)
    expect(performer).toHaveBeenCalledWith({
      table: 'projects',
      query: {
        $and: [{ is_followed: { $aeq: true } }, { _status: { $ne: 'deleted' } }],
      },
      originalConditions: [Q.where('is_followed', true), Q.where('_status', Q.notEq('deleted'))],
      mapKey: 'id',
      joinKey: 'project_id',
    })
    expect(performer).toHaveBeenCalledWith({
      table: 'tag_assignments',
      query: {
        $and: [{ foo: { $eq: 'bar' } }, { _status: { $ne: 'deleted' } }],
      },
      originalConditions: [Q.where('foo', 'bar'), Q.where('_status', Q.notEq('deleted'))],
      mapKey: 'task_id',
      joinKey: 'id',
    })
  })
})
