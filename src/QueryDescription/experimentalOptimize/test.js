import optimizeQueryDescription from './index'
import * as Q from '../index'
import { buildQueryDescription } from '../helpers'

// appSchema({
//   version: 1,
//   tables: [
//     tableSchema({
//       name: 'foo',
//       columns: [
//         { name: 'col1', type: 'string' },
//         { name: 'col2', type: 'number' },
//       ],
//     }),
//     tableSchema({
//       name: 'bar',
//       columns: [
//         { name: 'col1', type: 'number' },
//         { name: 'col2', type: 'boolean' },
//         { name: 'col3', type: 'boolean' },
//       ],
//     }),
//   ],
// })

describe('optimizeQueryDescription', () => {
  const optimize = (clauses) => {
    const query = buildQueryDescription(clauses)
    const optimized = optimizeQueryDescription(query)
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
})
