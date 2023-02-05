import { appSchema, tableSchema } from '../../Schema'
import optimizeQueryDescription from './index'
import * as Q from '../index'
import { buildQueryDescription } from '../helpers'

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'str', type: 'string' },
        { name: 'num', type: 'number' },
        { name: 'bool', type: 'boolean' },
        { name: 'str_i', type: 'string', isIndexed: true },
        { name: 'num_i', type: 'number', isIndexed: true },
        { name: 'bool_i', type: 'boolean', isIndexed: true },
      ],
    }),
    // tableSchema({
    //   name: 'bar',
    //   columns: [
    //     { name: 'col1', type: 'number' },
    //     { name: 'col2', type: 'boolean' },
    //     { name: 'col3', type: 'boolean' },
    //   ],
    // }),
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
      Q.and(Q.where('foo', 'bar')),
    ]
    expect(optimize(orig)).toEqual(orig)
  })
  it(`merges Q.ons`, () => {
    expect(
      optimize([
        Q.on('table', 'foo', 'bar'),
        Q.on('table', [
          //
          Q.where('bar', 'baz'),
          Q.where('baz', 'blah'),
        ]),
      ]),
    ).toEqual([
      Q.on('table', [
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
        Q.on('table', 'foo', 'bar'),
        Q.where('bar', 'baz'),
      ]),
    ).toEqual([
      //
      Q.where('bar', 'baz'),
      Q.on('table', 'foo', 'bar'),
    ])
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
})
