import Query from '../../../Query'
import Model from '../../../Model'
import * as Q from '../../../QueryDescription'
import encodeQuery from './index'

class MockTask extends Model {
  static table = 'tasks'

  static associations = {
    projects: { type: 'belongs_to', key: 'project_id' },
    tag_assignments: { type: 'has_many', foreignKey: 'task_id' },
  }
}

const mockCollection = Object.freeze({ modelClass: MockTask })

describe('SQLite encodeQuery', () => {
  it('encodes simple queries', () => {
    const query = new Query(mockCollection, [])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes multiple conditions and value types', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', `value "'with'" quotes`),
      Q.where('col2', 2),
      Q.where('col3', true),
      Q.where('col4', false),
      Q.where('col5', null),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'value "''with''" quotes' and "tasks"."col2" is 2 and "tasks"."col3" is 1 and "tasks"."col4" is 0 and "tasks"."col5" is null and "tasks"."_status" is not 'deleted'`,
    )
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
      Q.where('col8', Q.notIn(['"a"', '\'b\'', 'c'])),
      Q.where('col9', Q.between(10, 11)),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'val1' and "tasks"."col2" > 2 and "tasks"."col3" >= 3 and "tasks"."col3_5" > 3.5 and "tasks"."col4" < 4 and "tasks"."col5" <= 5 and "tasks"."col6" is not null and "tasks"."col7" in (1, 2, 3) and "tasks"."col8" not in ('"a"', '''b''', 'c') and "tasks"."col9" between 10 and 11 and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes column comparisons', () => {
    const query = new Query(mockCollection, [
      Q.where('left1', Q.gte(Q.column('right1'))),
      Q.where('left2', Q.weakGt(Q.column('right2'))),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."left1" >= "tasks"."right1" and ("tasks"."left2" > "tasks"."right2" or ("tasks"."left2" is not null and "tasks"."right2" is null)) and "tasks"."_status" is not 'deleted'`,
    )
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
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" is 'value' and ("tasks"."col2" is 1 or "tasks"."col3" is null or ("tasks"."col4" > 5 and "tasks"."col5" not in (6, 7))) and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes count queries', () => {
    const query = new Query(mockCollection, [Q.where('col1', 'value')])
    const sql = encodeQuery(query, true)
    expect(sql).toBe(
      `select count(*) as "count" from "tasks" where "tasks"."col1" is 'value' and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes JOIN queries', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'team_id', 'abcdef'),
      Q.on('projects', 'is_active', true),
      Q.where('left_column', 'right_value'),
      Q.on('tag_assignments', 'tag_id', Q.oneOf(['a', 'b', 'c'])),
    ])
    const expectedQuery = `join "projects" on "projects"."id" = "tasks"."project_id" join "tag_assignments" on "tag_assignments"."task_id" = "tasks"."id" where "projects"."team_id" is 'abcdef' and "projects"."is_active" is 1 and "tag_assignments"."tag_id" in ('a', 'b', 'c') and "projects"."_status" is not 'deleted' and "tag_assignments"."_status" is not 'deleted' and "tasks"."left_column" is 'right_value' and "tasks"."_status" is not 'deleted'`

    expect(encodeQuery(query)).toBe(`select distinct "tasks".* from "tasks" ${expectedQuery}`)
    expect(encodeQuery(query, true)).toBe(
      `select count(distinct "tasks"."id") as "count" from "tasks" ${expectedQuery}`,
    )
  })
  it('encodes column comparisons on JOIN queries', () => {
    const query = new Query(mockCollection, [
      Q.on('projects', 'left_column', Q.lte(Q.column('right_column'))),
      Q.on('projects', 'left2', Q.weakGt(Q.column('right2'))),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" join "projects" on "projects"."id" = "tasks"."project_id" where "projects"."left_column" <= "projects"."right_column" and ("projects"."left2" > "projects"."right2" or ("projects"."left2" is not null and "projects"."right2" is null)) and "projects"."_status" is not 'deleted' and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('encodes like and notLike queries', () => {
    const query = new Query(mockCollection, [
      Q.where('col1', Q.like('%abc')),
      Q.where('col2', Q.notLike('def%')),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."col1" like '%abc' and "tasks"."col2" not like 'def%' and "tasks"."_status" is not 'deleted'`,
    )
  })
  it('fails to encode bad oneOf/notIn values', () => {
    {
      const query = new Query(mockCollection, [Q.where('col7', Q.oneOf([{}]))])
      expect(() => encodeQuery(query)).toThrow(/Invalid value to encode into query/)
    }
    {
      const query = new Query(mockCollection, [Q.where('col7', Q.notIn([{}]))])
      expect(() => encodeQuery(query)).toThrow(/Invalid value to encode into query/)
    }
  })
  it('encodes order by clause', () => {
    const query = new Query(mockCollection, [Q.experimentalSortBy('sortable_column', Q.desc)])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc`,
    )
  })
  it('encodes multiple order by clauses', () => {
    const query = new Query(mockCollection, [
      Q.experimentalSortBy('sortable_column', Q.desc),
      Q.experimentalSortBy('sortable_column2', Q.asc),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc, "tasks"."sortable_column2" asc`,
    )
  })
  it('encodes limit clause', () => {
    const query = new Query(mockCollection, [Q.experimentalTake(100)])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' limit 100`,
    )
  })
  it('encodes limit with offset clause', () => {
    const query = new Query(mockCollection, [Q.experimentalTake(100), Q.experimentalSkip(200)])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' limit 100 offset 200`,
    )
  })
  it('encodes order by together with limit and offset clause', () => {
    const query = new Query(mockCollection, [
      Q.experimentalSortBy('sortable_column', 'desc'),
      Q.experimentalTake(100),
      Q.experimentalSkip(200),
    ])
    expect(encodeQuery(query)).toBe(
      `select "tasks".* from "tasks" where "tasks"."_status" is not 'deleted' order by "tasks"."sortable_column" desc limit 100 offset 200`,
    )
  })
})
