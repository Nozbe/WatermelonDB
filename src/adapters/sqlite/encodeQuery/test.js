/* eslint-disable prefer-template */
import Query from '../../../Query'
import Model from '../../../Model'
import * as Q from '../../../QueryDescription'
import encodeQuery from './index'

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

const encoded = (clauses, countMode) => encodeQuery(new Query(mockCollection, clauses), countMode)

describe('SQLite encodeQuery', () => {
  it('encodes simple queries', () => {
    expect(encoded([])).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted'`,
    )
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
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'value "''with''" quotes'` +
        ` and "tasks"."col2" is 2` +
        ` and "tasks"."col3" is 1` +
        ` and "tasks"."col4" is 0` +
        ` and "tasks"."col5" is null` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
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
        Q.where('col8', Q.notIn(['"a"', "'b'", 'c'])),
        Q.where('col9', Q.between(10, 11)),
        Q.where('col10', Q.like('%abc')),
        Q.where('col11', Q.notLike('def%')),
      ]),
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'val1'` +
        ` and "tasks"."col2" > 2` +
        ` and "tasks"."col3" >= 3` +
        ` and "tasks"."col3_5" > 3.5` +
        ` and "tasks"."col4" < 4` +
        ` and "tasks"."col5" <= 5` +
        ` and "tasks"."col6" is not null` +
        ` and "tasks"."col7" in (1, 2, 3)` +
        ` and "tasks"."col8" not in ('"a"', '''b''', 'c')` +
        ` and "tasks"."col9" between 10 and 11` +
        ` and "tasks"."col10" like '%abc'` +
        ` and "tasks"."col11" not like 'def%'` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes column comparisons', () => {
    expect(
      encoded([
        Q.where('left1', Q.gte(Q.column('right1'))),
        Q.where('left2', Q.weakGt(Q.column('right2'))),
      ]),
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."left1" >= "tasks"."right1" and ("tasks"."left2" > "tasks"."right2" or ("tasks"."left2" is not null and "tasks"."right2" is null)) and "tasks"."_status" is not 'deleted'`,
    )
  })
  it(`encodes raw SQL expressions`, () => {
    expect(encoded([Q.unsafeSqlExpr('tasks.left1 >= projects.right1')])).toBe(
      `select "tasks".* from "tasks" where tasks.left1 >= projects.right1 and "tasks"."_status" is not 'deleted'`,
    )
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
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'value'` +
        ` and ("tasks"."col2" is 1 or "tasks"."col3" is null` +
        ` or ("tasks"."col4" > 5` +
        ` and "tasks"."col5" not in (6, 7)))` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes count queries', () => {
    expect(encoded([Q.where('col1', 'value')], true)).toBe(
      `select count(*) as "count" from "tasks" where "tasks"."col1" is 'value' and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes JOIN queries', () => {
    const query = [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.on('projects', 'is_active', true),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
    ]
    const expectedQuery =
      `join "projects" on "projects"."id" = "tasks"."project_id"` +
      ` join "tag_assignments" on "tag_assignments"."task_id" = "tasks"."id"` +
      ` where ("projects"."team_id" is 'abcdef'` +
      ` and "projects"."is_active" is 1` +
      ` and "projects"."_status" is not 'deleted')` +
      ` and ("tag_assignments"."tag_id" in ('a', 'b', 'c')` +
      ` and "tag_assignments"."_status" is not 'deleted')` +
      ` and "tasks"."left_column" is 'right_value'` +
      ` and "tasks"."_status" is not 'deleted'`
    expect(encoded(query)).toBe(`select distinct "tasks".* from "tasks" ${expectedQuery}`)
    expect(encoded(query, true)).toBe(
      `select count(distinct "tasks"."id") as "count" from "tasks" ${expectedQuery}`,
    )
  })
  it('encodes column comparisons on JOIN queries', () => {
    expect(
      encoded([
        Q.on('projects', 'left_column', Q.lte(Q.column('right_column'))),
        Q.on('projects', 'left2', Q.weakGt(Q.column('right2'))),
      ]),
    ).toBe(
      `select "tasks".* from "tasks"` +
        ` join "projects" on "projects"."id" = "tasks"."project_id"` +
        ` where ("projects"."left_column" <= "projects"."right_column"` +
        ` and ("projects"."left2" > "projects"."right2"` +
        ` or ("projects"."left2" is not null` +
        ` and "projects"."right2" is null))` +
        ` and "projects"."_status" is not 'deleted')` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it(`encodes on nested in and/or`, () => {
    expect(
      encoded([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.on('projects', 'is_followed', true),
          Q.and(Q.on('tag_assignments', 'foo', 'bar')),
        ),
      ]),
    ).toBe(
      `select distinct "tasks".* from "tasks"` +
        ` left join "projects" on "projects"."id" = "tasks"."project_id"` +
        ` left join "tag_assignments" on "tag_assignments"."task_id" = "tasks"."id"` +
        ` where ("tasks"."is_followed" is 1` +
        ` or ("projects"."is_followed" is 1 and "projects"."_status" is not 'deleted')` +
        ` or (("tag_assignments"."foo" is 'bar' and "tag_assignments"."_status" is not 'deleted')))` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it(`encodes Q.on nested inside Q.on`, () => {
    expect(
      encoded([
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', Q.on('teams', 'foo', 'bar')),
      ]),
    ).toBe(
      `select "tasks".* from "tasks"` +
        ` join "projects" on "projects"."id" = "tasks"."project_id"` +
        ` left join "teams" on "teams"."id" = "projects"."team_id"` +
        ` where (("teams"."foo" is 'bar'` +
        ` and "teams"."_status" is not 'deleted')` +
        ` and "projects"."_status" is not 'deleted')` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it(`encodes multiple conditions on Q.on`, () => {
    expect(
      encoded([
        Q.on('projects', [
          Q.where('foo', 'bar'),
          Q.or(Q.where('bar', 'baz'), Q.where('bla', 'boop')),
        ]),
      ]),
    ).toBe(
      `select "tasks".* from "tasks"` +
        ` join "projects" on "projects"."id" = "tasks"."project_id"` +
        ` where ("projects"."foo" is 'bar'` +
        ` and ("projects"."bar" is 'baz'` +
        ` or "projects"."bla" is 'boop')` +
        ` and "projects"."_status" is not 'deleted')` +
        ` and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('fails to encode bad oneOf/notIn values', () => {
    expect(() => encoded([Q.where('col7', Q.oneOf([{}]))])).toThrow(
      'Invalid value to encode into query',
    )
    expect(() => encoded([Q.where('col7', Q.notIn([{}]))])).toThrow(
      'Invalid value to encode into query',
    )
  })
  it(`fails to encode nested on without explicit joinTables`, () => {
    expect(() => encoded([Q.or(Q.on('projects', 'is_followed', true))])).toThrow(
      'explicitly declare Q.experimentalJoinTables',
    )
  })
  it('encodes order by clause', () => {
    expect(encoded([Q.experimentalSortBy('sortable_column', Q.desc)])).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc`,
    )
  })
  it('encodes multiple order by clauses', () => {
    expect(
      encoded([
        Q.experimentalSortBy('sortable_column', Q.desc),
        Q.experimentalSortBy('sortable_column2', Q.asc),
      ]),
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc, "tasks"."sortable_column2" asc`,
    )
  })
  it('encodes limit clause', () => {
    expect(encoded([Q.experimentalTake(100)])).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' limit 100`,
    )
  })
  it('encodes limit with offset clause', () => {
    expect(encoded([Q.experimentalTake(100), Q.experimentalSkip(200)])).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' limit 100 offset 200`,
    )
  })
  it('encodes order by together with limit and offset clause', () => {
    expect(
      encoded([
        Q.experimentalSortBy('sortable_column', 'desc'),
        Q.experimentalTake(100),
        Q.experimentalSkip(200),
      ]),
    ).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc limit 100 offset 200`,
    )
  })
  it(`does not encode loki-specific syntax`, () => {
    expect(() => encoded([Q.unsafeLokiExpr({ hi: true })])).toThrow('Unknown clause')
    expect(() => encoded([Q.unsafeLokiTransform(() => {})])).toThrow('not supported')
  })
})
