import * as Q from './index'

describe('QueryDescription', () => {
  it('builds empty query', () => {
    const query = Q.buildQueryDescription([])
    expect(query).toEqual({
      where: [],
      join: [],
    })
  })
  it('builds simple query', () => {
    const query = Q.buildQueryDescription([Q.where('left_column', 'right_value')])
    expect(query).toEqual({
      where: [
        {
          type: 'where',
          left: 'left_column',
          comparison: {
            operator: 'eq',
            right: { value: 'right_value' },
          },
        },
      ],
      join: [],
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
        {
          type: 'where',
          left: 'col1',
          comparison: {
            operator: 'eq',
            right: { value: 'val1' },
          },
        },
        {
          type: 'where',
          left: 'col2',
          comparison: {
            operator: 'eq',
            right: { value: 2 },
          },
        },
        {
          type: 'where',
          left: 'col3',
          comparison: {
            operator: 'eq',
            right: { value: true },
          },
        },
        {
          type: 'where',
          left: 'col4',
          comparison: {
            operator: 'eq',
            right: { value: false },
          },
        },
        {
          type: 'where',
          left: 'col5',
          comparison: {
            operator: 'eq',
            right: { value: null },
          },
        },
      ],
      join: [],
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
        {
          type: 'where',
          left: 'col1',
          comparison: {
            operator: 'eq',
            right: { value: 'val1' },
          },
        },
        {
          type: 'where',
          left: 'col2',
          comparison: {
            operator: 'gt',
            right: { value: 2 },
          },
        },
        {
          type: 'where',
          left: 'col3',
          comparison: {
            operator: 'gte',
            right: { value: 3 },
          },
        },
        {
          type: 'where',
          left: 'col3_5',
          comparison: {
            operator: 'weakGt',
            right: { value: 3.5 },
          },
        },
        {
          type: 'where',
          left: 'col4',
          comparison: {
            operator: 'lt',
            right: { value: 4 },
          },
        },
        {
          type: 'where',
          left: 'col5',
          comparison: {
            operator: 'lte',
            right: { value: 5 },
          },
        },
        {
          type: 'where',
          left: 'col6',
          comparison: {
            operator: 'notEq',
            right: { value: null },
          },
        },
        {
          type: 'where',
          left: 'col7',
          comparison: {
            operator: 'oneOf',
            right: { values: [1, 2, 3] },
          },
        },
        {
          type: 'where',
          left: 'col8',
          comparison: {
            operator: 'notIn',
            right: { values: ['a', 'b', 'c'] },
          },
        },
        {
          type: 'where',
          left: 'col9',
          comparison: {
            operator: 'between',
            right: { values: [10, 11] },
          },
        },
        {
          type: 'where',
          left: 'col10',
          comparison: {
            operator: 'like',
            right: { value: '%abc' },
          },
        },
        {
          type: 'where',
          left: 'col11',
          comparison: {
            operator: 'notLike',
            right: { value: 'def%' },
          },
        },
      ],
      join: [],
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
      join: [],
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
        {
          type: 'where',
          left: 'col1',
          comparison: {
            operator: 'eq',
            right: { value: 'value' },
          },
        },
        {
          type: 'or',
          conditions: [
            {
              type: 'where',
              left: 'col2',
              comparison: {
                operator: 'eq',
                right: { value: true },
              },
            },
            {
              type: 'where',
              left: 'col3',
              comparison: {
                operator: 'eq',
                right: { value: null },
              },
            },
            {
              type: 'and',
              conditions: [
                {
                  type: 'where',
                  left: 'col4',
                  comparison: {
                    operator: 'gt',
                    right: { value: 5 },
                  },
                },
                {
                  type: 'where',
                  left: 'col5',
                  comparison: {
                    operator: 'notIn',
                    right: { values: [6, 7] },
                  },
                },
              ],
            },
          ],
        },
      ],
      join: [],
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
          type: 'where',
          left: 'left_column',
          comparison: {
            operator: 'eq',
            right: { value: 'right_value' },
          },
        },
      ],
      join: [
        {
          type: 'on',
          table: 'foreign_table',
          left: 'foreign_column',
          comparison: {
            operator: 'eq',
            right: { value: 'value' },
          },
        },
        {
          type: 'on',
          table: 'foreign_table2',
          left: 'foreign_column2',
          comparison: {
            operator: 'gt',
            right: { column: 'foreign_column3' },
          },
        },
      ],
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
  it('builds empty query without deleted', () => {
    const query = Q.queryWithoutDeleted(Q.buildQueryDescription([]))
    expect(query).toEqual({
      where: [
        {
          type: 'where',
          left: '_status',
          comparison: {
            operator: 'notEq',
            right: { value: 'deleted' },
          },
        },
      ],
      join: [],
    })
  })
  it('builds simple query without deleted', () => {
    const query = Q.queryWithoutDeleted(
      Q.buildQueryDescription([Q.where('left_column', 'right_value')]),
    )
    expect(query).toEqual({
      where: [
        {
          type: 'where',
          left: 'left_column',
          comparison: {
            operator: 'eq',
            right: { value: 'right_value' },
          },
        },
        {
          type: 'where',
          left: '_status',
          comparison: {
            operator: 'notEq',
            right: { value: 'deleted' },
          },
        },
      ],
      join: [],
    })
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
    expect(query).toEqual({
      where: [
        {
          type: 'where',
          left: 'left_column',
          comparison: {
            operator: 'eq',
            right: { value: 'right_value' },
          },
        },
        {
          type: 'where',
          left: '_status',
          comparison: {
            operator: 'notEq',
            right: { value: 'deleted' },
          },
        },
      ],
      join: [
        {
          type: 'on',
          table: 'foreign_table',
          left: 'foreign_column',
          comparison: {
            operator: 'eq',
            right: { value: 'value' },
          },
        },
        {
          type: 'on',
          table: 'foreign_table',
          left: 'foreign_column4',
          comparison: {
            operator: 'eq',
            right: { value: 'value' },
          },
        },
        {
          type: 'on',
          table: 'foreign_table2',
          left: 'foreign_column2',
          comparison: {
            operator: 'gt',
            right: { column: 'foreign_column3' },
          },
        },
        {
          type: 'on',
          table: 'foreign_table',
          left: '_status',
          comparison: {
            operator: 'notEq',
            right: { value: 'deleted' },
          },
        },
        {
          type: 'on',
          table: 'foreign_table2',
          left: '_status',
          comparison: {
            operator: 'notEq',
            right: { value: 'deleted' },
          },
        },
      ],
    })
  })

  it('supports textMatches as fts join', () => {
    const query = Q.buildQueryDescription([
      Q.textMatches('searchable', 'hello world'),
    ])
    expect(query).toEqual({
      'where': [
        {
          'operator': 'match',
          'right': {
            'value': 'searchable',
          },
        },
      ],
      'join': [],
    })
  })
})
