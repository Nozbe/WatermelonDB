// @flow

import type { QueryDescription } from '../../QueryDescription'

export const forbiddenError = `Queries with joins, sortBy, take, skip, lokiFilter can't be encoded into a matcher`

export default function canEncodeMatcher(query: QueryDescription): boolean {
  const { joinTables, nestedJoinTables, sortBy, take, skip, lokiFilter, sql } = query

  return (
    !joinTables.length &&
    !nestedJoinTables.length &&
    !sortBy.length &&
    !take &&
    !skip &&
    !lokiFilter &&
    !sql
  )
}
