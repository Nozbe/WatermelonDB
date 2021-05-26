import Query from '../../../../Query'
import Model from '../../../../Model'
import * as Q from '../../../../QueryDescription'
import encodeQueryRaw from './index'

// TODO: Standardize these mocks (same as in sqlite encodeQuery, query test)

class MockTask extends Model {
  static table = 'tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}

class MockProject extends Model {
  static table = 'projects'

  static associations = {
    teams: { type: 'belongs_to', key: 'team_id' },
  }
}

const mockCollection = Object.freeze({
  modelClass: MockTask,
  db: { get: (table) => (table === 'projects' ? { modelClass: MockProject } : {}) },
})

const encoded = (clauses) => encodeQueryRaw(new Query(mockCollection, clauses).serialize())

describe('LokiJS encodeQuery', () => {
  it('encodes simple queries', () => {
    expect(encoded([])).toEqual({
      table: 'tasks',
      query: { _status: { $ne: 'deleted' } },
      hasJoins: false,
    })
  })
  it('encodes a single condition', () => {
    expect(encoded([Q.where('col', 'hello')])).toEqual({
      table: 'tasks',
      query: {
        $and: [{ col: { $eq: 'hello' } }, { _status: { $ne: 'deleted' } }],
      },
      hasJoins: false,
    })
  })
  it('encodes multiple conditions and value types', () => {
    expect(
      encoded([
        Q.where('col1', `value "'with'" quotes`),
        Q.where('col2', 2),
        Q.where('col3', true),
        Q.where('col4', false),
        Q.where('col5', null),
      ]),
    ).toEqual({
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
      hasJoins: false,
    })
  })
  it('encodes multiple operators', () => {
    expect(
      encoded([
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
        Q.where('col10', Q.like('%abc')),
        Q.where('col11', Q.notLike('%abc')),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { col1: { $eq: 'val1' } },
          { col2: { $gt: 2 } },
          { col3: { $gte: 3 } },
          { col3_5: { $gt: 3.5 } },
          { col4: { $and: [{ $lt: 4 }, { $not: { $aeq: null } }] } },
          { col5: { $and: [{ $lte: 5 }, { $not: { $aeq: null } }] } },
          { col6: { $not: { $aeq: null } } },
          { col7: { $in: [1, 2, 3] } },
          { col8: { $and: [{ $nin: ['"a"', 'b', 'c'] }, { $not: { $aeq: null } }] } },
          { col9: { $between: [10, 11] } },
          { col10: { $regex: /^.*abc$/is } },
          { col11: { $and: [{ $not: { $eq: null } }, { $not: { $regex: /^.*abc$/is } }] } },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: false,
    })
  })
  it('encodes column comparisons', () => {
    expect(
      encoded([
        Q.where('col1', Q.eq(Q.column('right'))),
        Q.where('col2', Q.gt(Q.column('right'))),
        Q.where('col3', Q.gte(Q.column('right'))),
        Q.where('col3_5', Q.weakGt(Q.column('right'))),
        Q.where('col4', Q.lt(Q.column('right'))),
        Q.where('col5', Q.lte(Q.column('right'))),
        Q.where('col6', Q.notEq(Q.column('right'))),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { col1: { $$aeq: 'right' } },
          { $and: [{ col2: { $$gt: 'right' } }, { right: { $not: { $aeq: null } } }] },
          { $and: [{ col3: { $$gte: 'right' } }, { right: { $not: { $aeq: null } } }] },
          { col3_5: { $$gt: 'right' } },
          {
            $and: [
              { col4: { $and: [{ $$lt: 'right' }, { $not: { $aeq: null } }] } },
              { right: { $not: { $aeq: null } } },
            ],
          },
          {
            $and: [
              { col5: { $and: [{ $$lte: 'right' }, { $not: { $aeq: null } }] } },
              { right: { $not: { $aeq: null } } },
            ],
          },
          { col6: { $not: { $$aeq: 'right' } } },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: false,
    })
  })
  it('encodes AND/OR nesting', () => {
    expect(
      encoded([
        Q.where('col1', 'value'),
        Q.or(
          Q.where('col2', true),
          Q.where('col3', null),
          Q.and(Q.where('col4', Q.gt(5)), Q.where('col5', Q.notIn([6, 7]))),
        ),
      ]),
    ).toEqual({
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
                  { col5: { $and: [{ $nin: [6, 7] }, { $not: { $aeq: null } }] } },
                ],
              },
            ],
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: false,
    })
  })
  it('encodes JOIN queries', () => {
    expect(
      encoded([
        Q.on('projects', 'team_id', 'abcdef'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
        Q.on('projects', 'is_active', true),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          {
            $join: {
              table: 'projects',
              query: {
                $and: [{ team_id: { $eq: 'abcdef' } }, { _status: { $ne: 'deleted' } }],
              },
              mapKey: 'id',
              joinKey: 'project_id',
            },
          },
          { left_column: { $eq: 'right_value' } },
          {
            $join: {
              table: 'tag_assignments',
              query: {
                $and: [{ tag_id: { $in: ['a', 'b', 'c'] } }, { _status: { $ne: 'deleted' } }],
              },
              mapKey: 'task_id',
              joinKey: 'id',
            },
          },
          {
            $join: {
              table: 'projects',
              query: {
                $and: [{ is_active: { $aeq: true } }, { _status: { $ne: 'deleted' } }],
              },
              mapKey: 'id',
              joinKey: 'project_id',
            },
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: true,
    })
  })
  it(`encodes on()s nested inside AND/ORs`, () => {
    expect(
      encoded([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.on('projects', 'is_followed', true),
          Q.and(Q.on('tag_assignments', 'foo', 'bar')),
        ),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          {
            $or: [
              { is_followed: { $aeq: true } },
              {
                $join: {
                  table: 'projects',
                  query: {
                    $and: [{ is_followed: { $aeq: true } }, { _status: { $ne: 'deleted' } }],
                  },
                  mapKey: 'id',
                  joinKey: 'project_id',
                },
              },
              {
                $join: {
                  table: 'tag_assignments',
                  query: {
                    $and: [{ foo: { $eq: 'bar' } }, { _status: { $ne: 'deleted' } }],
                  },
                  mapKey: 'task_id',
                  joinKey: 'id',
                },
              },
            ],
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: true,
    })
  })
  it(`encodes Q.on nested inside Q.on`, () => {
    expect(
      encoded([
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', Q.on('teams', 'foo', 'bar')),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          {
            $join: {
              table: 'projects',
              query: {
                $and: [
                  {
                    $join: {
                      table: 'teams',
                      query: { $and: [{ foo: { $eq: 'bar' } }, { _status: { $ne: 'deleted' } }] },
                      mapKey: 'id',
                      joinKey: 'team_id',
                    },
                  },
                  { _status: { $ne: 'deleted' } },
                ],
              },
              mapKey: 'id',
              joinKey: 'project_id',
            },
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: true,
    })
  })
  it(`encodes multiple conditions on Q.on`, () => {
    expect(
      encoded([
        Q.on('projects', [
          Q.where('foo', 'bar'),
          Q.or(Q.where('bar', 'baz'), Q.where('bla', Q.gt(Q.column('boop')))),
        ]),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          {
            $join: {
              table: 'projects',
              query: {
                $and: [
                  { foo: { $eq: 'bar' } },
                  {
                    $or: [
                      { bar: { $eq: 'baz' } },
                      { $and: [{ bla: { $$gt: 'boop' } }, { boop: { $not: { $aeq: null } } }] },
                    ],
                  },
                  { _status: { $ne: 'deleted' } },
                ],
              },
              mapKey: 'id',
              joinKey: 'project_id',
            },
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: true,
    })
  })
  it('encodes unsafe loki subexpressions', () => {
    expect(
      encoded([
        Q.unsafeLokiExpr({ foo: { $jgt: 10 } }),
        Q.on('projects', Q.unsafeLokiExpr({ bar: { $jbetween: [1, 2] } })),
      ]),
    ).toEqual({
      table: 'tasks',
      query: {
        $and: [
          { foo: { $jgt: 10 } },
          {
            $join: {
              table: 'projects',
              query: { $and: [{ bar: { $jbetween: [1, 2] } }, { _status: { $ne: 'deleted' } }] },
              mapKey: 'id',
              joinKey: 'project_id',
            },
          },
          { _status: { $ne: 'deleted' } },
        ],
      },
      hasJoins: true,
    })
  })
  it(`fails to encode nested on without explicit joinTables`, () => {
    expect(() => encoded([Q.or(Q.on('projects', 'is_followed', true))])).toThrow(
      'explicitly declare Q.experimentalJoinTables',
    )
  })
  it(`throws an error on unsupported query clauses`, () => {
    expect(() => encoded([Q.unsafeSqlExpr('haha sql goes brrr')])).toThrow('Unknown clause')
    expect(() => encoded([Q.unsafeSqlQuery('select * from tasks')])).toThrow('not supported')
    expect(() => encoded([Q.experimentalSortBy('foo', 'asc')])).toThrow('not supported')
    expect(() => encoded([Q.experimentalTake(5)])).toThrow('not supported')
  })
})
