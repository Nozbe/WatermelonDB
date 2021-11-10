import * as Q from './index'

describe('buildQueryDescription', () => {
  it('builds empty query', () => {
    const query = Q.buildQueryDescription([])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('builds simple query', () => {
    const query = Q.buildQueryDescription([Q.where('left_column', 'right_value')])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'where',
          left: 'left_column',
          comparison: { operator: 'eq', right: { value: 'right_value' } },
        },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('accepts multiple conditions and value types', () => {
    const query = Q.buildQueryDescription([
      Q.where('col1', 'val1'),
      Q.where('col2', 2),
      Q.where('col3', true),
      Q.where('col4', false),
      Q.where('col5', null),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        { type: 'where', left: 'col1', comparison: { operator: 'eq', right: { value: 'val1' } } },
        { type: 'where', left: 'col2', comparison: { operator: 'eq', right: { value: 2 } } },
        { type: 'where', left: 'col3', comparison: { operator: 'eq', right: { value: true } } },
        { type: 'where', left: 'col4', comparison: { operator: 'eq', right: { value: false } } },
        { type: 'where', left: 'col5', comparison: { operator: 'eq', right: { value: null } } },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports multiple operators', () => {
    const query = Q.buildQueryDescription([
      Q.where('col1', Q.eq('val1')),
      Q.where('col2', Q.gt(2)),
      Q.where('col3', Q.gte(3)),
      Q.where('col3_5', Q.weakGt(3.5)),
      Q.where('col4', Q.lt(4)),
      Q.where('col5', Q.lte(5)),
      Q.where('col6', Q.notEq(null)),
      Q.where('col7', Q.oneOf([1, 2, 3])),
      Q.where('col8', Q.notIn(['a', 'b', 'c'])),
      Q.where('col9', Q.between(10, 11)),
      Q.where('col10', Q.like('%abc')),
      Q.where('col11', Q.notLike('def%')),
      Q.where('col12', Q.includes('foo')),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        { type: 'where', left: 'col1', comparison: { operator: 'eq', right: { value: 'val1' } } },
        { type: 'where', left: 'col2', comparison: { operator: 'gt', right: { value: 2 } } },
        { type: 'where', left: 'col3', comparison: { operator: 'gte', right: { value: 3 } } },
        {
          type: 'where',
          left: 'col3_5',
          comparison: { operator: 'weakGt', right: { value: 3.5 } },
        },
        { type: 'where', left: 'col4', comparison: { operator: 'lt', right: { value: 4 } } },
        { type: 'where', left: 'col5', comparison: { operator: 'lte', right: { value: 5 } } },
        { type: 'where', left: 'col6', comparison: { operator: 'notEq', right: { value: null } } },
        {
          type: 'where',
          left: 'col7',
          comparison: { operator: 'oneOf', right: { values: [1, 2, 3] } },
        },
        {
          type: 'where',
          left: 'col8',
          comparison: { operator: 'notIn', right: { values: ['a', 'b', 'c'] } },
        },
        {
          type: 'where',
          left: 'col9',
          comparison: { operator: 'between', right: { values: [10, 11] } },
        },
        {
          type: 'where',
          left: 'col10',
          comparison: { operator: 'like', right: { value: '%abc' } },
        },
        {
          type: 'where',
          left: 'col11',
          comparison: { operator: 'notLike', right: { value: 'def%' } },
        },
        {
          type: 'where',
          left: 'col12',
          comparison: { operator: 'includes', right: { value: 'foo' } },
        },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports column comparisons', () => {
    const query = Q.buildQueryDescription([Q.where('left_column', Q.gte(Q.column('right_column')))])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'where',
          left: 'left_column',
          comparison: {
            operator: 'gte',
            right: { column: 'right_column' },
          },
        },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports AND/OR nesting', () => {
    const query = Q.buildQueryDescription([
      Q.where('col1', 'value'),
      Q.or(
        Q.where('col2', true),
        Q.where('col3', null),
        Q.and(Q.where('col4', Q.gt(5)), Q.where('col5', Q.notIn([6, 7]))),
      ),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        { type: 'where', left: 'col1', comparison: { operator: 'eq', right: { value: 'value' } } },
        {
          type: 'or',
          conditions: [
            { type: 'where', left: 'col2', comparison: { operator: 'eq', right: { value: true } } },
            { type: 'where', left: 'col3', comparison: { operator: 'eq', right: { value: null } } },
            {
              type: 'and',
              conditions: [
                {
                  type: 'where',
                  left: 'col4',
                  comparison: { operator: 'gt', right: { value: 5 } },
                },
                {
                  type: 'where',
                  left: 'col5',
                  comparison: { operator: 'notIn', right: { values: [6, 7] } },
                },
              ],
            },
          ],
        },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it(`supports unsafe SQL and Loki expressions`, () => {
    const query = Q.buildQueryDescription([
      Q.unsafeSqlExpr(`some sql`),
      Q.unsafeLokiExpr({ column: { $jgt: 5 } }),
      Q.and(Q.unsafeSqlExpr(`some sql`)),
      Q.or(Q.unsafeLokiExpr({ column: { $jgt: 5 } })),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        { type: 'sql', expr: `some sql` },
        { type: 'loki', expr: { column: { $jgt: 5 } } },
        { type: 'and', conditions: [{ type: 'sql', expr: `some sql` }] },
        { type: 'or', conditions: [{ type: 'loki', expr: { column: { $jgt: 5 } } }] },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it(`supports unsafe Loki transform`, () => {
    const transform = (records, _loki) => records
    const query = Q.buildQueryDescription([Q.unsafeLokiTransform(transform)])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      lokiTransform: transform,
    })
  })
  it(`supports unsafe SQL queries`, () => {
    const query = Q.buildQueryDescription([
      Q.unsafeSqlQuery("select * from tasks where foo = 'bar'"),
    ])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      sql: { type: 'sqlQuery', sql: "select * from tasks where foo = 'bar'", values: [] },
    })
  })
  it(`supports unsafe SQL queries with placeholder values`, () => {
    const query = Q.buildQueryDescription([
      Q.unsafeSqlQuery('select * from tasks where foo = ? and bar = ?', ['hello', 'world']),
    ])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      sql: {
        type: 'sqlQuery',
        sql: 'select * from tasks where foo = ? and bar = ?',
        values: ['hello', 'world'],
      },
    })
  })
  it(`prevents use of unsafe sql queries with other clauses`, () => {
    expect(() => {
      Q.buildQueryDescription([
        Q.unsafeSqlQuery("select * from tasks where foo = 'bar'"),
        Q.where('foo', 'bar'),
      ])
    }).toThrow('Cannot use Q.unsafeSqlQuery with')
    expect(() => {
      Q.buildQueryDescription([
        Q.where('foo', 'bar'),
        Q.unsafeSqlQuery("select * from tasks where foo = 'bar'"),
      ])
    }).toThrow('Cannot use Q.unsafeSqlQuery with')
  })
  it(`allows unsafe SQL queries to be properly observable`, () => {
    const query = Q.buildQueryDescription([
      Q.experimentalJoinTables(['projects']),
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.unsafeSqlQuery(
        'select tasks.* from tasks ' +
          'left join projects on tasks.project_id is projects.id ' +
          'left join teams on projects.team_id is teams.id ',
      ),
    ])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: ['projects'],
      nestedJoinTables: [{ from: 'projects', to: 'teams' }],
      sortBy: [],
      sql: {
        type: 'sqlQuery',
        sql:
          'select tasks.* from tasks ' +
          'left join projects on tasks.project_id is projects.id ' +
          'left join teams on projects.team_id is teams.id ',
        values: [],
      },
    })
  })
  it('supports simple JOIN queries', () => {
    const query = Q.buildQueryDescription([
      Q.on('foreign_table', 'foreign_column', 'value'),
      Q.where('left_column', 'right_value'),
      Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'on',
          table: 'foreign_table',
          conditions: [
            {
              type: 'where',
              left: 'foreign_column',
              comparison: { operator: 'eq', right: { value: 'value' } },
            },
          ],
        },
        {
          type: 'where',
          left: 'left_column',
          comparison: { operator: 'eq', right: { value: 'right_value' } },
        },
        {
          type: 'on',
          table: 'foreign_table2',
          conditions: [
            {
              type: 'where',
              left: 'foreign_column2',
              comparison: { operator: 'gt', right: { column: 'foreign_column3' } },
            },
          ],
        },
      ],
      joinTables: ['foreign_table', 'foreign_table2'],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it(`supports nesting Q.on inside and/or`, () => {
    const query = Q.buildQueryDescription([
      Q.experimentalJoinTables(['projects', 'foreign_table2']),
      Q.or(
        Q.where('is_followed', true),
        Q.on('projects', 'is_followed', true),
        Q.and(Q.on('foreign_table2', 'foo', 'bar')),
      ),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'or',
          conditions: [
            {
              type: 'where',
              left: 'is_followed',
              comparison: { operator: 'eq', right: { value: true } },
            },
            {
              type: 'on',
              table: 'projects',
              conditions: [
                {
                  type: 'where',
                  left: 'is_followed',
                  comparison: { operator: 'eq', right: { value: true } },
                },
              ],
            },
            {
              type: 'and',
              conditions: [
                {
                  type: 'on',
                  table: 'foreign_table2',
                  conditions: [
                    {
                      type: 'where',
                      left: 'foo',
                      comparison: { operator: 'eq', right: { value: 'bar' } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      joinTables: ['projects', 'foreign_table2'],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it(`supports multiple conditions on Q.on`, () => {
    const query = Q.buildQueryDescription([
      Q.on('projects', [
        Q.where('foo', 'bar'),
        Q.or(Q.where('bar', 'baz'), Q.where('bla', 'boop')),
      ]),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'on',
          table: 'projects',
          conditions: [
            { type: 'where', left: 'foo', comparison: { operator: 'eq', right: { value: 'bar' } } },
            {
              type: 'or',
              conditions: [
                {
                  type: 'where',
                  left: 'bar',
                  comparison: { operator: 'eq', right: { value: 'baz' } },
                },
                {
                  type: 'where',
                  left: 'bla',
                  comparison: { operator: 'eq', right: { value: 'boop' } },
                },
              ],
            },
          ],
        },
      ],
      joinTables: ['projects'],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it(`supports deep nesting Q.on inside Q.on`, () => {
    const query = Q.buildQueryDescription([
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.experimentalNestedJoin('teams', 'organizations'),
      Q.on('projects', Q.on('teams', Q.on('organizations', 'foo', 'bar'))),
    ])
    expect(query).toEqual({
      select: [],
      where: [
        {
          type: 'on',
          table: 'projects',
          conditions: [
            {
              type: 'on',
              table: 'teams',
              conditions: [
                {
                  type: 'on',
                  table: 'organizations',
                  conditions: [
                    {
                      type: 'where',
                      left: 'foo',
                      comparison: { operator: 'eq', right: { value: 'bar' } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      joinTables: ['projects'],
      nestedJoinTables: [
        { from: 'projects', to: 'teams' },
        { from: 'teams', to: 'organizations' },
      ],
      sortBy: [],
    })
  })
  it(`supports Q.on shortcut syntaxes`, () => {
    const expected = Q.on('projects', [Q.where('foo', Q.eq('bar'))])
    expect(Q.on('projects', 'foo', 'bar')).toEqual(expected)
    expect(Q.on('projects', 'foo', Q.eq('bar'))).toEqual(expected)
    expect(Q.on('projects', Q.where('foo', 'bar'))).toEqual(expected)
    expect(Q.on('projects', Q.and(Q.where('foo', 'bar'), Q.where('bar', 'baz')))).toEqual(
      Q.on('projects', [Q.where('foo', 'bar'), Q.where('bar', 'baz')]),
    )
  })
  it(`does not compress top-level Q.ons into a single nested Q.on`, () => {
    // TODO: Remove this test after deprecation warning is removed
    expect(
      Q.buildQueryDescription([
        Q.on('projects', 'p1', 'v1'),
        Q.on('projects', 'p2', 'v2'),
        Q.on('teams', 't1', 'v1'),
        Q.on('projects', 'p3', 'v3'),
      ]),
    ).toEqual({
      select: [],
      where: [
        Q.on('projects', 'p1', 'v1'),
        Q.on('projects', 'p2', 'v2'),
        Q.on('teams', 't1', 'v1'),
        Q.on('projects', 'p3', 'v3'),
      ],
      joinTables: ['projects', 'teams'],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports sorting query', () => {
    const query = Q.buildQueryDescription([Q.sortBy('sortable_column', Q.desc)])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [{ type: 'sortBy', sortColumn: 'sortable_column', sortOrder: 'desc' }],
    })
  })
  it('does not support skip operator without take operator', () => {
    expect(() => {
      Q.buildQueryDescription([Q.skip(100)])
    }).toThrow('cannot skip without take')
  })
  it('support multiple skip operators but only take the last', () => {
    const query = Q.buildQueryDescription([Q.take(100), Q.skip(200), Q.skip(400), Q.skip(800)])
    expect(query).toEqual({
      select: [],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      take: 100,
      skip: 800,
    })
  })
  it('deep freezes the query in dev', () => {
    const make = () => Q.buildQueryDescription([Q.where('left_column', 'right_value')])
    const query = make()
    expect(() => {
      query.foo = []
    }).toThrow()
    expect(() => {
      query.where[0].comparison.right = {}
    }).toThrow()
    expect(query).toEqual(make())
  })
  it('freezes oneOf/notIn, even in production', () => {
    const env = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'
      const ohJustAnArray = [1, 2, 3]
      const anotherArray = ['a', 'b', 'c']
      Q.buildQueryDescription([
        Q.where('col7', Q.oneOf(ohJustAnArray)),
        Q.where('col8', Q.notIn(anotherArray)),
      ])
      expect(() => ohJustAnArray.push(4)).toThrow()
      expect(() => anotherArray.push('d')).toThrow()
      expect(ohJustAnArray.length).toBe(3)
      expect(anotherArray.length).toBe(3)
    } finally {
      process.env.NODE_ENV = env
    }
  })
  it('catches bad types', () => {
    expect(() => Q.eq({})).toThrow('Invalid value passed to query')
    expect(() => Q.where('foo', undefined)).toThrow('undefined')
    // TODO: oneOf/notIn values?
    expect(() => Q.oneOf({})).toThrow('not an array')
    expect(() => Q.notIn({})).toThrow('not an array')
    expect(() => Q.like(null)).toThrow('not a string')
    expect(() => Q.like({})).toThrow('not a string')
    expect(() => Q.notLike(null)).toThrow('not a string')
    expect(() => Q.notLike({})).toThrow('not a string')
    expect(() => Q.includes(null)).toThrow('not a string')
    expect(() => Q.sanitizeLikeString(null)).toThrow('not a string')
    expect(() => Q.column({})).toThrow('not a string')
    expect(() => Q.take('0')).toThrow('not a number')
    expect(() => Q.skip('0')).toThrow('not a number')
    expect(() => Q.unsafeSqlExpr({})).toThrow('not a string')
    expect(() => Q.unsafeLokiExpr()).toThrow('not an object')
    expect(() => Q.unsafeLokiExpr('hey')).toThrow('not an object')
    expect(() => Q.unsafeSqlQuery(null)).toThrow('not a string')
    expect(() => Q.unsafeSqlQuery('foo', null)).toThrow('not an array')
  })
  it(`catches bad argument values`, () => {
    expect(() => Q.sortBy('foo', 'ascasc')).toThrow('Invalid sortOrder')
    expect(() => Q.where('foo', Q.unsafeSqlExpr('is RANDOM()'))).toThrow()
    expect(() => Q.where('foo', Q.unsafeLokiExpr('is RANDOM()'))).toThrow()
    expect(() => Q.and(Q.like('foo'))).toThrow('can only contain')
    expect(() => Q.or(Q.like('foo'))).toThrow('can only contain')
    expect(() => Q.or(Q.unsafeSqlQuery('foo'))).toThrow('can only contain')
    expect(() => Q.on('foo', Q.column('foo'))).toThrow('can only contain')
    expect(() => Q.buildQueryDescription([Q.like('foo')])).toThrow('Invalid Query clause passed')
    expect(() => Q.experimentalJoinTables('foo', 'bar')).toThrow('expected an array')
  })
  it('protect against passing Watermelon look-alike objects', () => {
    // protect against passing something that could be a user-input Object (risk is when Watermelon users pass stuff from JSON without validation), but is unintended or even malicious in some way
    expect(() => Q.eq({ column: 'foo' })).toThrow(/Invalid { column: }/)
    expect(() => Q.where('foo', { operator: 'eq', right: { value: 'foo' } })).toThrow(
      'Invalid Comparison',
    )
    expect(() => Q.where('foo', {})).toThrow('Invalid Comparison')
    expect(() => Q.on('table', 'foo', {})).toThrow('Invalid Comparison')
    expect(() => Q.on('table', 'foo', Q.eq({ column: 'foo' }))).toThrow(/Invalid { column: }/)
  })
  it(`protects against unsafe column and table names passed`, () => {
    expect(() => Q.column('sqlite_master')).toThrow('Unsafe name')
    expect(() => Q.column('hey` or --')).toThrow('Unsafe name')
    expect(() => Q.where('rowid', 10)).toThrow('Unsafe name')
    expect(() => Q.sortBy('sqlite_master', 'asc')).toThrow('Unsafe name')
    expect(() => Q.on('sqlite_master', 'foo', 'bar')).toThrow('Unsafe name')
    expect(() => Q.on('sqlite_master', Q.where('foo', 'bar'))).toThrow('Unsafe name')
    expect(() => Q.experimentalJoinTables(['foo', 'sqlite_master'])).toThrow('Unsafe name')
    expect(() => Q.experimentalNestedJoin('sqlite_master', 'foo')).toThrow('Unsafe name')
    expect(() => Q.experimentalNestedJoin('foo', 'sqlite_master')).toThrow('Unsafe name')
  })
})

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
  it('supports selected columns in query', () => {
    const query = Q.buildQueryDescription([Q.experimentalSelect(['col1', 'col2'])])
    expect(query).toEqual({
      select: [
        {
          type: 'select',
          columns: ['id', 'col1', 'col2'],
        },
      ],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports multiple select queries', () => {
    const query = Q.buildQueryDescription([
      Q.experimentalSelect(['col1', 'col2']),
      Q.experimentalSelect(['col2', 'col3']),
    ])
    expect(query).toEqual({
      select: [
        {
          type: 'select',
          columns: ['id', 'col1', 'col2'],
        },
        {
          type: 'select',
          columns: ['id', 'col2', 'col3'],
        },
      ],
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
  it('supports select with where conditions', () => {
    const query = Q.buildQueryDescription([
      Q.experimentalSelect(['col1', 'col2']),
      Q.where('col', 'val'),
    ])
    expect(query).toEqual({
      select: [
        {
          type: 'select',
          columns: ['id', 'col1', 'col2'],
        },
      ],
      where: [
        {
          type: 'where',
          left: 'col',
          comparison: {
            operator: 'eq',
            right: { value: 'val' },
          },
        },
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
    })
  })
})
