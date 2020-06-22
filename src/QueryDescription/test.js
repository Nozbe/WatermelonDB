import * as Q from './index'

describe('buildQueryDescription', () => {
  it('builds empty query', () => {
    const query = Q.buildQueryDescription([])
    expect(query).toEqual({
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      skip: null,
      take: null,
    })
  })
  it('builds simple query', () => {
    const query = Q.buildQueryDescription([Q.where('left_column', 'right_value')])
    expect(query).toEqual({
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
      skip: null,
      take: null,
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
      skip: null,
      take: null,
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
    ])
    expect(query).toEqual({
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
      ],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      skip: null,
      take: null,
    })
  })
  it('supports column comparisons', () => {
    const query = Q.buildQueryDescription([Q.where('left_column', Q.gte(Q.column('right_column')))])
    expect(query).toEqual({
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
      skip: null,
      take: null,
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
      skip: null,
      take: null,
    })
  })
  it('supports simple JOIN queries', () => {
    const query = Q.buildQueryDescription([
      Q.on('foreign_table', 'foreign_column', 'value'),
      Q.where('left_column', 'right_value'),
      Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
    ])
    expect(query).toEqual({
      where: [
        {
          type: 'on',
          table: 'foreign_table',
          left: 'foreign_column',
          comparison: { operator: 'eq', right: { value: 'value' } },
        },
        {
          type: 'where',
          left: 'left_column',
          comparison: { operator: 'eq', right: { value: 'right_value' } },
        },
        {
          type: 'on',
          table: 'foreign_table2',
          left: 'foreign_column2',
          comparison: { operator: 'gt', right: { column: 'foreign_column3' } },
        },
      ],
      joinTables: ['foreign_table', 'foreign_table2'],
      nestedJoinTables: [],
      sortBy: [],
      skip: null,
      take: null,
    })
  })
  it('supports alternative `on` syntax', () => {
    const query = Q.buildQueryDescription([
      Q.on('foreign_table', Q.where('foreign_column', 'value')),
      Q.on('foreign_table2', Q.where('foreign_column2', Q.gt(Q.column('foreign_column3')))),
    ])

    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.on('foreign_table', 'foreign_column', 'value'),
        Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
      ]),
    )
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
              left: 'is_followed',
              comparison: { operator: 'eq', right: { value: true } },
            },
            {
              type: 'and',
              conditions: [
                {
                  type: 'on',
                  table: 'foreign_table2',
                  left: 'foo',
                  comparison: { operator: 'eq', right: { value: 'bar' } },
                },
              ],
            },
          ],
        },
      ],
      joinTables: ['projects', 'foreign_table2'],
      nestedJoinTables: [],
      sortBy: [],
      take: null,
      skip: null,
    })
  })
  it(`supports nesting Q.on inside Q.on`, () => {
    const query = Q.buildQueryDescription([
      Q.experimentalJoinTables(['projects']),
      Q.experimentalNestedJoin('projects', 'teams'),
      Q.on('projects', Q.on('teams', 'foo', 'bar')),
    ])
    expect(query).toEqual({
      where: [
        {
          type: 'on',
          table: 'projects',
          nested: {
            type: 'on',
            table: 'teams',
            left: 'foo',
            comparison: { operator: 'eq', right: { value: 'bar' } },
          },
        },
      ],
      joinTables: ['projects'],
      nestedJoinTables: [{ from: 'projects', to: 'teams' }],
      sortBy: [],
      take: null,
      skip: null,
    })
  })
})

describe('hasColumnComparisons', () => {
  it('can recognize whether a query has column comparisons or not', () => {
    const query1 = Q.buildQueryDescription([])
    expect(Q.hasColumnComparisons(query1)).toBe(false)

    const query2 = Q.buildQueryDescription([
      Q.where('col1', 'value'),
      Q.or(
        Q.where('col2', true),
        Q.where('col3', null),
        Q.and(Q.where('col4', Q.gt(5)), Q.where('col5', Q.notIn([6, 7]))),
      ),
      Q.on('foreign_table', 'foreign_column', 'value'),
    ])
    expect(Q.hasColumnComparisons(query2)).toBe(false)

    const query3 = Q.buildQueryDescription([
      Q.where('left_column', Q.gte(Q.column('right_column'))),
    ])
    expect(Q.hasColumnComparisons(query3)).toBe(true)
  })
  it(`can find deeply neested column comparisons`, () => {
    const query4 = Q.buildQueryDescription([
      Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
    ])
    expect(Q.hasColumnComparisons(query4)).toBe(true)

    const query5 = Q.buildQueryDescription([
      Q.where('col1', 'value'),
      Q.or(
        Q.where('col2', true),
        Q.and(Q.where('col4', Q.gt(5)), Q.where('left_column', Q.gte(Q.column('right_column')))),
      ),
    ])
    expect(Q.hasColumnComparisons(query5)).toBe(true)
  })
  it(`doesn't get fooled by broken oneOf/notIn`, () => {
    // we don't validate elements of arrays passed to Q.oneOf/Q.notIn
    // because they may be large, so make sure even if someone passes a bad object, it doesn't break this logic
    const query6 = Q.buildQueryDescription([Q.where('heh', Q.notIn([6, { column: 'heh' }]))])
    expect(Q.hasColumnComparisons(query6)).toBe(false)
  })
})

describe('queryWithoutDeleted', () => {
  it('builds empty query without deleted', () => {
    const query = Q.queryWithoutDeleted(Q.buildQueryDescription([]))
    expect(query).toEqual(Q.buildQueryDescription([Q.where('_status', Q.notEq('deleted'))]))
  })
  it('builds simple query without deleted', () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([Q.where('left_column', 'right_value')]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.where('left_column', 'right_value'),
        Q.where('_status', Q.notEq('deleted')),
      ]),
    )
  })
  it('supports simple 2 JOIN queries on one table and JOIN query on another without deleted', () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([
        Q.on('foreign_table', 'foreign_column', 'value'),
        Q.on('foreign_table', 'foreign_column4', 'value'),
        Q.where('left_column', 'right_value'),
        Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.on('foreign_table', 'foreign_column', 'value'),
        Q.on('foreign_table', 'foreign_column4', 'value'),
        Q.where('left_column', 'right_value'),
        Q.on('foreign_table2', 'foreign_column2', Q.gt(Q.column('foreign_column3'))),
        Q.on('foreign_table', '_status', Q.notEq('deleted')),
        Q.on('foreign_table2', '_status', Q.notEq('deleted')),
        Q.where('_status', Q.notEq('deleted')),
      ]),
    )
  })
  it(`supports nested Q.ons`, () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.on('projects', 'is_followed', true),
          Q.on('projects', 'foo', 'bar'),
          Q.and(
            Q.on('tag_assignments', 'foo', 'bar'),
            Q.and(Q.on('tag_assignments', 'foo', 'baz'), Q.on('tag_assignments', 'foo', 'bazz')),
          ),
        ),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects', 'tag_assignments']),
        Q.or(
          Q.where('is_followed', true),
          Q.and(
            Q.on('projects', 'is_followed', true),
            Q.on('projects', '_status', Q.notEq('deleted')),
          ),
          Q.and(Q.on('projects', 'foo', 'bar'), Q.on('projects', '_status', Q.notEq('deleted'))),
          Q.and(
            Q.on('tag_assignments', 'foo', 'bar'),
            Q.and(
              Q.on('tag_assignments', 'foo', 'baz'),
              Q.on('tag_assignments', 'foo', 'bazz'),
              Q.on('tag_assignments', '_status', Q.notEq('deleted')),
            ),
            Q.on('tag_assignments', '_status', Q.notEq('deleted')),
          ),
        ),
        Q.where('_status', Q.notEq('deleted')),
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
        Q.or(Q.on('projects', Q.on('teams', 'foo', 'bar'))),
      ]),
    )
    expect(query).toEqual(
      Q.buildQueryDescription([
        Q.experimentalJoinTables(['projects']),
        Q.experimentalNestedJoin('projects', 'teams'),
        Q.on('projects', Q.on('teams', 'foo', 'bar')),
        Q.or(
          Q.and(
            Q.on('projects', Q.on('teams', 'foo', 'bar')),
            Q.on('projects', Q.on('teams', '_status', Q.notEq('deleted'))),
            Q.on('projects', '_status', Q.notEq('deleted')),
          ),
        ),
        Q.on('projects', Q.on('teams', '_status', Q.notEq('deleted'))),
        Q.on('projects', '_status', Q.notEq('deleted')),
        Q.where('_status', Q.notEq('deleted')),
      ]),
    )
  })
})

describe('buildQueryDescription - contd', () => {
  it('supports sorting query', () => {
    const query = Q.buildQueryDescription([Q.experimentalSortBy('sortable_column', Q.desc)])
    expect(query).toEqual({
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [{ type: 'sortBy', sortColumn: 'sortable_column', sortOrder: 'desc' }],
      skip: null,
      take: null,
    })
  })
  it('supports take operator', () => {
    const query = Q.buildQueryDescription([Q.experimentalTake(100)])
    expect(query).toEqual({
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      take: 100,
      skip: null,
    })
  })
  it('does not support skip operator without take operator', () => {
    expect(() => {
      Q.buildQueryDescription([Q.experimentalSkip(100)])
    }).toThrow('cannot skip without take')
  })
  it('supports multiple take operators and take the last', () => {
    const query = Q.buildQueryDescription([
      Q.experimentalTake(100),
      Q.experimentalTake(200),
      Q.experimentalTake(400),
    ])
    expect(query).toEqual({
      where: [],
      joinTables: [],
      nestedJoinTables: [],
      sortBy: [],
      take: 400,
      skip: null,
    })
  })
  it('support multiple skip operators but only take the last', () => {
    const query = Q.buildQueryDescription([
      Q.experimentalTake(100),
      Q.experimentalSkip(200),
      Q.experimentalSkip(400),
      Q.experimentalSkip(800),
    ])
    expect(query).toEqual({
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
    expect(() => Q.eq({})).toThrow(/Invalid value passed to query/)
    // TODO: oneOf/notIn values?
    expect(() => Q.oneOf({})).toThrow(/not an array/)
    expect(() => Q.notIn({})).toThrow(/not an array/)
    expect(() => Q.like(null)).toThrow(/not string/)
    expect(() => Q.like({})).toThrow(/not string/)
    expect(() => Q.notLike(null)).toThrow(/not string/)
    expect(() => Q.notLike({})).toThrow(/not string/)
    expect(() => Q.sanitizeLikeString(null)).toThrow(/not string/)
    expect(() => Q.column({})).toThrow(/not string/)
    expect(() => Q.experimentalTake('0')).toThrow(/not a number/)
    expect(() => Q.experimentalSkip('0')).toThrow(/not a number/)
  })
  it(`catches bad argument values`, () => {
    expect(() => Q.experimentalSortBy('foo', 'ascasc')).toThrow(/Invalid sortOrder/)
    expect(() => Q.and(Q.like('foo'))).toThrow(/and\(\) can only contain/)
    expect(() => Q.or(Q.like('foo'))).toThrow(/or\(\) can only contain/)
    expect(() => Q.buildQueryDescription([Q.like('foo')])).toThrow('Invalid Query clause passed')
    expect(() => Q.experimentalJoinTables('foo', 'bar')).toThrow('expected an array')
    expect(() => Q.on('foo', Q.column('foo'))).toThrow('can only be passed Q.where, Q.on clauses')
  })
  it('protect against passing Watermelon look-alike objects', () => {
    // protect against passing something that could be a user-input Object (risk is when Watermelon users pass stuff from JSON without validation), but is unintended or even malicious in some way
    expect(() => Q.eq({ column: 'foo' })).toThrow(/Invalid { column: }/)
    expect(() => Q.where('foo', { operator: 'eq', right: { value: 'foo' } })).toThrow(
      /Invalid Comparison/,
    )
    expect(() => Q.where('foo', {})).toThrow(/Invalid Comparison/)
    expect(() => Q.on('table', 'foo', {})).toThrow(/Invalid Comparison/)
    expect(() => Q.on('table', 'foo', Q.eq({ column: 'foo' }))).toThrow(/Invalid { column: }/)
  })
  it(`protects against unsafe column and table names passed`, () => {
    expect(() => Q.column('sqlite_master')).toThrow(/Unsafe name/)
    expect(() => Q.column('hey` or --')).toThrow(/Unsafe name/)
    expect(() => Q.where('rowid', 10)).toThrow(/Unsafe name/)
    expect(() => Q.experimentalSortBy('sqlite_master', 'asc')).toThrow(/Unsafe name/)
    expect(() => Q.on('sqlite_master', 'foo', 'bar')).toThrow(/Unsafe name/)
    expect(() => Q.on('sqlite_master', Q.where('foo', 'bar'))).toThrow(/Unsafe name/)
    expect(() => Q.experimentalJoinTables(['foo', 'sqlite_master'])).toThrow(/Unsafe name/)
    expect(() => Q.experimentalNestedJoin('sqlite_master', 'foo')).toThrow(/Unsafe name/)
    expect(() => Q.experimentalNestedJoin('foo', 'sqlite_master')).toThrow(/Unsafe name/)
  })
})
