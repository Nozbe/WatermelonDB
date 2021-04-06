// @flow

import type { QueryDescription } from '../../QueryDescription'

export const forbiddenError = `Queries with joins, sortBy, take, skip, lokiTransform can't be encoded into a matcher`

export default function canEncodeMatcher(query: QueryDescription): boolean {
  const { joinTables, nestedJoinTables, sortBy, take, skip, lokiTransform } = query

  return (
    !joinTables.length &&
    !nestedJoinTables.length &&
    !sortBy.length &&
    !take &&
    !skip &&
    !lokiTransform
  )
}
