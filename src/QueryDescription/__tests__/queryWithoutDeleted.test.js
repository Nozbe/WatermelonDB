import * as Q from '../index'

describe('queryWithoutDeleted', () => {
  const whereNotDeleted = Q.where('_status', Q.notEq('deleted'))
  it('builds empty query without deleted', () => {
    const query = Q.queryWithoutDeleted(Q.buildQueryDescription([]))
    expect(query).toEqual(Q.buildQueryDescription([whereNotDeleted]))
  })
  it('builds simple query without deleted', () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([Q.where('left_column', 'right_value')]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([Q.where('left_column', 'right_value'), whereNotDeleted]),
    )
  })
  it('supports simple 2 JOIN queries on one table and JOIN query on another without deleted', () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([
        Q.on('projects', 'col1', 'value'),
        Q.on('projects', 'col2', 'value'),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', 'col3', Q.gt(Q.column('col4'))),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.on('projects', [Q.where('col1', 'value'), whereNotDeleted]),
        Q.on('projects', [Q.where('col2', 'value'), whereNotDeleted]),
        Q.where('left_column', 'right_value'),
        Q.on('tag_assignments', [Q.where('col3', Q.gt(Q.column('col4'))), whereNotDeleted]),
        whereNotDeleted,
      ]),
    )
  })
  it(`supports nested Q.ons`, () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.on('projects', [Q.where('is_followed', true), Q.where('foo', 'bar')]),
          Q.and(Q.on('tag_assignments', 'foo', 'bar')),
        ),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.on('projects', [Q.where('is_followed', true), Q.where('foo', 'bar'), whereNotDeleted]),
          Q.and(Q.on('tag_assignments', [Q.where('foo', 'bar'), whereNotDeleted])),
        ),
        whereNotDeleted,
      ]),
    )
  })
  it(`supports Q.ons on Q.on`, () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([
        // TODO: Test deeper nestings
        Q.experimentalJoinTables(['projects']),
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', Q.on('teams', 'foo', 'bar')),
        Q.or(Q.on('projects', Q.on('teams', Q.on('organizations', 'foo', 'bar')))),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects']),
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', [
          Q.on('teams', [Q.where('foo', 'bar'), whereNotDeleted]),
          whereNotDeleted,
        ]),
        Q.or(
          Q.on('projects', [
            Q.on('teams', [
              Q.on('organizations', [Q.where('foo', 'bar'), whereNotDeleted]),
              whereNotDeleted,
            ]),
            whereNotDeleted,
          ]),
        ),
        whereNotDeleted,
      ]),
    )
  })
})
