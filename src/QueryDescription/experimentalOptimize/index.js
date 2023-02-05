// @flow
/* eslint-disable no-use-before-define */

import deepFreeze from '../../utils/common/deepFreeze'
import * as Q from '../index'
import type { AppSchema, TableName } from '../../Schema'
import type { QueryDescription, Where, On, And, Or } from '../type'

// where()s first
// … but where()s with oneOf/notIn last (because it could be a long array)
// then on()s
// … but on()s querying has_manys before on()s querying belongs_tos
// … merge on()s querying the same table

// Goal:
// - order clauses such that heaviest to execute clauses are last
// - order clauses such that we filter out as many records as possible early
//
// It's hard to do this well without knowing the histogram of different values. SQLite can do this
// out of the box, so we probably don't have to worry about it at all. But for Loki, something
// might still be better than nothing...
//
// However we might be able to use information about schema to guess which fields are cheap to query (indexed)
//
// One simple way to aid in reordering is to allow users to pass Q.likely(), Q.unlikely(), but
// if we want users to add such information, they might as well manually tune the query order
// themselves, no?

type OptimizeQueryDescriptionOptions = $Exact<{
  query: QueryDescription,
  table: TableName<any>,
  schema: AppSchema,
}>
export default function optimizeQueryDescription(
  options: OptimizeQueryDescriptionOptions,
): QueryDescription {
  const { query, table, schema } = options
  const optimizedQuery = { ...query }
  const optimized = optimizeWhere(query.where, table, schema, 'and')
  optimizedQuery.where = getWheres(optimized)

  if (process.env.NODE_ENV !== 'production') {
    deepFreeze(optimizedQuery)
  }
  return optimizedQuery
}

type score = number // lower number = higher priority
type CondEntry = [Where, score]
type OnEntry = Where[][]
type ListContext = 'and' | 'or'

const getWheres = (entries: CondEntry[]): Where[] => entries.map(([condition]) => condition)

const DEFAULT_SCORE = 1
const INDEXED_MULTIPLIER = 0.1 // rationale: indexed fields are faster to query
const EQ_MULTIPLIER = 0.5 // rationale: equality yields fewer results than lt/gt
const oneOfMultiplier = (length: number) => Math.log2(length) / 2 + 1
const ON_MULTPLIER = 10

function optimizeWhere(
  conditions: Where[],
  table: TableName<any>,
  schema: AppSchema,
  listContext: ListContext,
): CondEntry[] {
  let optimized: CondEntry[] = []
  const tableSchema = schema.tables[table]

  conditions.forEach((condition) => {
    switch (condition.type) {
      case 'where': {
        const isIndexed = tableSchema.columns[condition.left]?.isIndexed
        const isEq = condition.comparison.operator === 'eq'
        const isOneOf = condition.comparison.operator === 'oneOf'
        optimized.push([
          condition,
          DEFAULT_SCORE *
            (isIndexed ? INDEXED_MULTIPLIER : 1) *
            (isEq ? EQ_MULTIPLIER : 1) *
            (isOneOf ? oneOfMultiplier((condition.comparison.right.values: any).length) : 1),
        ])
        break
      }
      case 'and': {
        const optimizedInner = optimizeWhere(condition.conditions, table, schema, 'and')

        // a && (b && c) == a && b && c
        // a || (b) == a || b
        if (listContext === 'and' || optimizedInner.length === 1) {
          optimized.push(...optimizedInner)
        } else {
          optimized.push([
            { ...condition, conditions: getWheres(optimizedInner) },
            // NOTE: we should have a score estimate for this
            DEFAULT_SCORE,
          ])
        }
        break
      }
      case 'or': {
        const optimizedInner = optimizeWhere(condition.conditions, table, schema, 'or')

        // a || (b || c) == a || b || c
        // a && (b) == a && b
        if (listContext === 'or' || optimizedInner.length === 1) {
          optimized.push(...optimizedInner)
        } else {
          optimized.push([
            { ...condition, conditions: getWheres(optimizedInner) },
            // NOTE: we should have a score estimate for this
            DEFAULT_SCORE,
          ])
        }
        break
      }
      case 'on': {
        // push as is, will be merged later
        optimized.push([condition, ON_MULTPLIER])
        break
      }
      default: {
        // SqlExpr, LokiExpr - we don't know how to score these
        optimized.push([condition, DEFAULT_SCORE])
        break
      }
    }
  })

  // merge & optimize ons
  // merging needs to be a second pass to be able to merge ons
  // originating from flattened and/or expressions
  // e.g. (on(a) || on(b)) && on(c) -> on((a || b) && c)
  optimized = mergeOns(optimized, table, schema, listContext)

  // sort by score
  optimized.sort(([, a], [, b]) => a - b)

  return optimized
}

function mergeOns(
  initial: CondEntry[],
  table: TableName<any>,
  schema: AppSchema,
  listContext: ListContext,
): CondEntry[] {
  const optimized: CondEntry[] = []
  const ons: { [table: TableName<any>]: OnEntry } = {}

  // extract all on's, grouped by table
  initial.forEach((condEntry) => {
    if (condEntry[0].type === 'on') {
      const on: On = condEntry[0]
      const { table: onTable, conditions: onConditions } = on
      const onEntry = ons[onTable]
      if (onEntry) {
        onEntry.push(onConditions)
      } else {
        ons[onTable] = [onConditions]
      }
    } else {
      optimized.push(condEntry)
    }
  })

  // merge&optimize entries
  Object.entries(ons).forEach(([onTable, manyOnConditions]) => {
    // merge
    const mergedOnCondiions = []
    manyOnConditions.forEach((conds) => {
      // on(a) && on(b && b) == on(a && b && c)
      // on(a) || on(b && c) == on(a || (b && c))
      // on(a) || on(b) == on(a || b)
      if (listContext === 'and' || conds.length === 1) {
        mergedOnCondiions.push(...conds)
      } else {
        mergedOnCondiions.push({ type: 'and', conditions: conds })
      }
    })

    const optimizedMerged = getWheres(
      optimizeWhere(mergedOnCondiions, (onTable: any), schema, listContext),
    )
    // wrap in or() if we're transforming on(a) || on(b) to on(a || b)
    const wrappedConditions =
      listContext === 'or' && optimizedMerged.length > 1
        ? [({ type: 'or', conditions: optimizedMerged }: Or)]
        : optimizedMerged

    const optimizedOn: On = {
      type: 'on',
      table: (onTable: any),
      conditions: wrappedConditions,
    }
    optimized.push([optimizedOn, ON_MULTPLIER])
  })

  return optimized
}
