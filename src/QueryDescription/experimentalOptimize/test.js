import { appSchema, tableSchema } from '../../Schema'
import optimizeQueryDescription from './index'
import * as Q from '../index'
import { buildQueryDescription } from '../helpers'

const standardColumns = [
  { name: 'str', type: 'string' },
  { name: 'num', type: 'number' },
  { name: 'bool', type: 'boolean' },
  { name: 'str_i', type: 'string', isIndexed: true },
  { name: 'num_i', type: 'number', isIndexed: true },
  { name: 'bool_i', type: 'boolean', isIndexed: true },
]
const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [...standardColumns],
    }),
    tableSchema({
      name: 'comments',
      columns: [...standardColumns],
    }),
  ],
})

describe('optimizeQueryDescription', () => {
  const optimize = (clauses) => {
    const query = buildQueryDescription(clauses)
    const optimized = optimizeQueryDescription({ query, table: 'tasks', schema })
    expect({ ...optimized, where: [] }).toEqual({ ...query, where: [] })
    return optimized.where
  }
  it(`empty query`, () => {
    expect(optimize([])).toEqual([])
  })
  it(`does not reorder conditions if profitability is unknown`, () => {
    const orig = [
      Q.where('foo', 'bar'),
      Q.unsafeSqlExpr(''),
      Q.unsafeLokiExpr({}),
      Q.or(Q.where('foo', 'bar')),
    ]
    expect(optimize(orig)).toEqual(orig)
  })
  it(`reorders indexed columns before unindexed`, () => {
    expect(
      optimize([
        //
        Q.where('str', 'bar'),
        Q.where('bool_i', 'bar'),
        Q.where('str_i', 'bar'),
      ]),
    ).toEqual([
      //
      Q.where('bool_i', 'bar'),
      Q.where('str_i', 'bar'),
      Q.where('str', 'bar'),
    ])
  })
  it(`reorders Q.eq before other comparisons`, () => {
    expect(
      optimize([
        //
        Q.where('str', Q.gt('bar')),
        Q.where('str', Q.notEq('bar')),
        Q.where('str', 'bar'),
      ]),
    ).toEqual([
      //
      Q.where('str', 'bar'),
      Q.where('str', Q.gt('bar')),
      Q.where('str', Q.notEq('bar')),
    ])
  })
  it(`reorders Q.oneOf depending on number of args`, () => {
    expect(
      optimize([
        //
        Q.where('str', Q.oneOf(Array(10).fill('bar'))),
        Q.where('str', Q.oneOf(Array(2).fill('bar'))),
        Q.where('str', Q.oneOf(Array(5).fill('bar'))),
        Q.where('str', 'bar'),
      ]),
    ).toEqual([
      //
      Q.where('str', 'bar'),
      Q.where('str', Q.oneOf(Array(2).fill('bar'))),
      Q.where('str', Q.oneOf(Array(5).fill('bar'))),
      Q.where('str', Q.oneOf(Array(10).fill('bar'))),
    ])
  })
  it(`flattens Q.and`, () => {
    expect(
      optimize([
        //
        Q.where('str', 'bar'),
        Q.and([
          //
          Q.where('str', 'bar2'),
          Q.and(Q.where('str', 'bar3')),
        ]),
      ]),
    ).toEqual([
      //
      Q.where('str', 'bar'),
      Q.where('str', 'bar2'),
      Q.where('str', 'bar3'),
    ])
  })
  it(`flattens Q.or`, () => {
    expect(
      optimize([
        //
        Q.where('str', 'bar'),
        Q.or([
          //
          Q.where('str', 'bar2'),
          Q.or(Q.where('str', 'bar3'), Q.where('str', 'bar4')),
        ]),
      ]),
    ).toEqual([
      //
      Q.where('str', 'bar'),
      Q.or([Q.where('str', 'bar2'), Q.where('str', 'bar3'), Q.where('str', 'bar4')]),
    ])
  })
  it(`flattens (merges) Q.ons`, () => {
    expect(
      optimize([
        Q.on('comments', 'foo', 'bar'),
        Q.on('comments', [
          //
          Q.where('bar', 'baz'),
          Q.where('baz', 'blah'),
        ]),
      ]),
    ).toEqual([
      Q.on('comments', [
        //
        Q.where('foo', 'bar'),
        Q.where('bar', 'baz'),
        Q.where('baz', 'blah'),
      ]),
    ])
  })
  it(`reorders Q.ons last`, () => {
    expect(
      optimize([
        //
        Q.on('comments', 'foo', 'bar'),
        Q.where('bar', 'baz'),
      ]),
    ).toEqual([
      //
      Q.where('bar', 'baz'),
      Q.on('comments', 'foo', 'bar'),
    ])
  })
  it(`optimizes Q.and`, () => {
    expect(
      optimize([
        Q.or(
          Q.and(
            //
            Q.where('str', 'bar'),
            Q.where('bool_i', 'bar'),
            Q.where('str_i', 'bar'),
          ),
        ),
      ]),
    ).toEqual([
      Q.or(
        Q.and(
          //
          Q.where('bool_i', 'bar'),
          Q.where('str_i', 'bar'),
          Q.where('str', 'bar'),
        ),
      ),
    ])
  })
  it(`optimizes Q.or`, () => {
    expect(
      optimize([
        Q.or(
          //
          Q.where('str', 'bar'),
          Q.where('bool_i', 'bar'),
          Q.where('str_i', 'bar'),
        ),
      ]),
    ).toEqual([
      Q.or(
        //
        Q.where('bool_i', 'bar'),
        Q.where('str_i', 'bar'),
        Q.where('str', 'bar'),
      ),
    ])
  })
  it(`optimizes Q.on`, () => {
    expect(
      optimize([
        //
        Q.on('comments', Q.where('str', 'bar')),
        Q.on('comments', [Q.where('bool_i', 'bar'), Q.where('str_i', 'bar')]),
      ]),
    ).toEqual([
      Q.on('comments', [
        //
        Q.where('bool_i', 'bar'),
        Q.where('str_i', 'bar'),
        Q.where('str', 'bar'),
      ]),
    ])
  })
  it('deep freezes the query in dev', () => {
    const make = () => optimize([Q.where('left_column', 'right_value')])
    const query = make()
    expect(() => {
      query.foo = []
    }).toThrow()
    expect(() => {
      query.where[0].comparison.right = {}
    }).toThrow()
    expect(query).toEqual(make())
  })
})
