// @flow
/* eslint-disable no-use-before-define */

import type { QueryDescription, Where, On } from '../type'

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

export default function optimizeQueryDescription(query: QueryDescription): QueryDescription {
  const optimizedQuery = { ...query }
  optimizedQuery.where = optimizeWhere(query.where)
  return optimizedQuery
}

function optimizeWhere(conditions: Where[]): Where[] {
  const optimized: Where[] = []
  const ons: { [table: string]: On } = {}

  conditions.forEach((condition) => {
    if (condition.type === 'on') {
      const existing = ons[condition.table]
      if (existing) {
        existing.conditions = [...existing.conditions, ...condition.conditions]
      } else {
        ons[condition.table] = { ...condition }
      }
    } else {
      optimized.push(condition)
    }
  })

  Object.values(ons).forEach((on) => {
    optimized.push(on)
  })

  return optimized
}
