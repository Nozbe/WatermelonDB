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
      name: 'projects',
      columns: [...standardColumns],
    }),
    tableSchema({
      name: 'tasks',
      columns: [...standardColumns.map((c) => ({ ...c, name: `t_${c.name}` }))],
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
    const optimized = optimizeQueryDescription({ query, table: 'projects', schema })
    expect({ ...optimized, where: [] }).toEqual({ ...query, where: [] })
    return optimized.where
  }
  it(`empty query`, () => {
    expect(optimize([])).toEqual([])
  })
  describe('reorders conditions', () => {
    it(`does not reorder conditions if profitability is unknown`, () => {
      const orig = [Q.where('foo', 'bar'), Q.unsafeSqlExpr(''), Q.unsafeLokiExpr({})]
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
    it(`reorders Q.ons last`, () => {
      expect(
        optimize([
          //
          Q.on('tasks', 'foo', 'bar'),
          Q.where('bar', 'baz'),
        ]),
      ).toEqual([
        //
        Q.where('bar', 'baz'),
        Q.on('tasks', 'foo', 'bar'),
      ])
    })
  })
  describe('flattens inner lists', () => {
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
    it(`does not flatten Q.and(Q.or), Q.or(Q.and)`, () => {
      const orig = [
        //
        Q.or(Q.where('str', 'bar'), Q.where('str', 'bar2')),
        Q.or(
          //
          Q.where('str', 'bar3'),
          Q.and(Q.where('str', 'bar'), Q.where('str', 'bar2')),
        ),
      ]
      expect(optimize(orig)).toEqual(orig)
    })
    it(`flattens 1-element Q.and(Q.or), Q.or(Q.and)`, () => {
      expect(
        optimize([
          //
          Q.or(Q.where('str', 'bar')),
          Q.or(Q.and(Q.where('str', 'bar')), Q.where('str', 'bar2')),
        ]),
      ).toEqual([
        //
        Q.where('str', 'bar'),
        Q.or(Q.where('str', 'bar'), Q.where('str', 'bar2')),
      ])
    })
    it(`flattens (merges) Q.ons`, () => {
      expect(
        optimize([
          Q.on('tasks', 'foo', 'bar'),
          Q.on('tasks', [
            //
            Q.where('bar', 'baz'),
            Q.where('baz', 'blah'),
          ]),
        ]),
      ).toEqual([
        Q.on('tasks', [
          //
          Q.where('foo', 'bar'),
          Q.where('bar', 'baz'),
          Q.where('baz', 'blah'),
        ]),
      ])
    })
    it(`flattens (merges) inner Q.ons`, () => {
      expect(
        optimize([
          Q.on('tasks', Q.on('comments', 'foo', 'bar')),
          Q.on(
            'tasks',
            Q.on('comments', [
              //
              Q.where('bar', 'baz'),
              Q.where('baz', 'blah'),
            ]),
          ),
        ]),
      ).toEqual([
        Q.on(
          'tasks',
          Q.on('comments', [
            //
            Q.where('foo', 'bar'),
            Q.where('bar', 'baz'),
            Q.where('baz', 'blah'),
          ]),
        ),
      ])
    })
    it(`does not merge Q.or(Q.on)`, () => {
      const orig = [
        Q.or(
          Q.on('tasks', 'foo', 'bar'),
          Q.on('tasks', [
            //
            Q.where('bar', 'baz'),
            Q.where('baz', 'blah'),
          ]),
        ),
      ]
      expect(optimize(orig)).toEqual(orig)
    })
    it.skip(`flattens complex nested conditions`, () => {
      expect(
        optimize([
          Q.and(
            Q.and(
              Q.and(
                //
                Q.on('tasks', 'foo', 'bar'),
                Q.on('tasks', Q.on('comments', 'foo', 'bar')),
              ),
            ),
            Q.or(Q.or(Q.or())),
          ),

          // Q.on('tasks', [
          //   //
          //   Q.where('bar', 'baz'),
          //   Q.where('baz', 'blah'),
          // ]),
        ]),
      ).toEqual([])
    })
  })
  describe('optimizes inner lists', () => {
    it(`optimizes Q.and`, () => {
      expect(
        optimize([
          Q.or(
            Q.where('str', 'baz'),
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
          Q.where('str', 'baz'),
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
          Q.on('tasks', Q.where('t_str', 'bar')),
          Q.on('tasks', [Q.where('t_bool_i', 'bar'), Q.where('t_str_i', 'bar')]),
        ]),
      ).toEqual([
        Q.on('tasks', [
          //
          Q.where('t_bool_i', 'bar'),
          Q.where('t_str_i', 'bar'),
          Q.where('t_str', 'bar'),
        ]),
      ])
    })
    it(`optimizes Q.or(Q.on)`, () => {
      expect(
        optimize([
          Q.or(
            Q.where('foo', 'bar'),
            Q.on('tasks', [
              //
              Q.where('t_str', 'bar'),
              Q.where('t_str_i', 'bar'),
            ]),
          ),
        ]),
      ).toEqual([
        Q.or(
          Q.where('foo', 'bar'),
          Q.on('tasks', [
            //
            Q.where('t_str_i', 'bar'),
            Q.where('t_str', 'bar'),
          ]),
        ),
      ])
    })
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
