// @flow

import type { QueryDescription } from '../../QueryDescription'

export default function canEncodeMatcher(query: QueryDescription): boolean {
  const { joinTables, nestedJoinTables, sortBy, take, skip, lokiFilter } = query

  return (
    !joinTables.length &&
    !nestedJoinTables.length &&
    !sortBy.length &&
    !take &&
    !skip &&
    !lokiFilter
  )
}
