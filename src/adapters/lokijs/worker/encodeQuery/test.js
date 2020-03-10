import Query from '../../../../Query'
import Model from '../../../../Model'
import * as Q from '../../../../QueryDescription'
import encodeQuery from './index'

class MockTask extends Model {
  static table = 'tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}

const mockCollection = Object.freeze({ modelClass: MockTask })

const testQuery = query => encodeQuery(query.serialize())

describe('LokiJS encodeQuery', () => {
  it('encodes simple queries', () => {
    const query = new Query(mockCollection, [])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: { _status: { $ne: 'deleted' } },
      joins: [],
    })
  })
  it('encodes a single condition', () => {
    const query = new Query(mockCollection, [Q.where('col', 'hello')])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [{ col: { $eq: 'hello' } }, { _status: { $ne: 'deleted' } }],
      },
      joins: [],
    })
  })
  it('encodes multiple onditions and value types', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', `value "'with'" quotes`),
      Q.where('col2', 2),
      Q.where('col3', true),
      Q.where('col4', false),
      Q.where('col5', null),
    ])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { col1: { $eq: `value "'with'" quotes` } },
          { col2: { $aeq: 2 } },
          { col3: { $aeq: true } },
          { col4: { $aeq: false } },
          { col5: { $aeq: null } },
          { _status: { $ne: 'deleted' } },
        ],
      },
      joins: [],
    })
  })
  it('encodes multiple operators', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', Q.eq('val1')),
      Q.where('col2', Q.gt(2)),
      Q.where('col3', Q.gte(3)),
      Q.where('col3_5', Q.weakGt(3.5)),
      Q.where('col4', Q.lt(4)),
      Q.where('col5', Q.lte(5)),
      Q.where('col6', Q.notEq(null)),
      Q.where('col7', Q.oneOf([1, 2, 3])),
      Q.where('col8', Q.notIn(['"a"', 'b', 'c'])),
      Q.where('col9', Q.between(10, 11)),
    ])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { col1: { $eq: 'val1' } },
          { col2: { $gt: 2 } },
          { col3: { $gte: 3 } },
          { col3_5: { $gt: 3.5 } },
          {
            col4: {
              $and: [{ $lt: 4 }, { $not: { $aeq: null } }],
            },
          },
          {
            col5: {
              $and: [{ $lte: 5 }, { $not: { $aeq: null } }],
            },
          },
          { col6: { $not: { $aeq: null } } },
          { col7: { $in: [1, 2, 3] } },
          {
            col8: {
              $and: [{ $nin: ['"a"', 'b', 'c'] }, { $not: { $aeq: null } }],
            },
          },
          { col9: { $between: [10, 11] } },
          { _status: { $ne: 'deleted' } },
        ],
      },
      joins: [],
    })
  })
  it('encodes column comparisons', () => {
    const query = new Query(mockCollection, [
      Q.where('left_column', Q.gte(Q.column('right_column'))),
    ])
    // TODO: The actual comparison is (currently) done in executor
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [{ _fakeAlwaysTrue: { $eq: undefined } }, { _status: { $ne: 'deleted' } }],
      },
      joins: [],
    })
  })
  it('encodes AND/OR nesting', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', 'value'),
      Q.or(
        Q.where('col2', true),
        Q.where('col3', null),
        Q.and(Q.where('col4', Q.gt(5)), Q.where('col5', Q.notIn([6, 7]))),
      ),
    ])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { col1: { $eq: 'value' } },
          {
            $or: [
              { col2: { $aeq: true } },
              { col3: { $aeq: null } },
              {
                $and: [
                  { col4: { $gt: 5 } },
                  {
                    col5: {
                      $and: [{ $nin: [6, 7] }, { $not: { $aeq: null } }],
                    },
                  },
                ],
              },
            ],
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      joins: [],
    })
  })
  it('encodes JOIN queries', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
      Q.on('projects', 'is_active', true),
    ])
    expect(testQuery(query)).toEqual({
      table: 'tasks',
      query: {
        $and: [{ left_column: { $eq: 'right_value' } }, { _status: { $ne: 'deleted' } }],
      },
      joins: [
        {
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
        },
        {
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
        },
      ],
    })
  })
  it('encodes column comparisons on JOIN queries', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'left_column', Q.lte(Q.column('right_column'))),
    ])
    // TODO: The actual comparison is (currently) done in executor
    expect(encodeQuery(query)).toEqual({
      table: 'tasks',
      query: {
        _status: { $ne: 'deleted' },
      },
      joins: [
        {
          table: 'projects',
          query: {
            $and: [{ _fakeAlwaysTrue: { $eq: undefined } }, { _status: { $ne: 'deleted' } }],
          },
          originalConditions: [
            Q.where('left_column', Q.lte(Q.column('right_column'))),
            Q.where('_status', Q.notEq('deleted')),
          ],
          mapKey: 'id',
          joinKey: 'project_id',
        },
      ],
    })
  })
  it('encodes like and notLike queries', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', Q.like('%abc')),
      Q.where('col2', Q.notLike('%abc')),
    ])
    const encodedQuery = testQuery(query)

    expect(encodedQuery.query.$and[0].col1.$regex.toString()).toEqual('/^.*abc$/i')
    expect(encodedQuery.query.$and[1].col2.$and[0].$not.$eq).toEqual(null)
    expect(encodedQuery.query.$and[1].col2.$and[1].$not.$regex.toString()).toEqual('/^.*abc$/i')
  })
})
