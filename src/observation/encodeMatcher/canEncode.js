// @flow

import type { QueryDescription, Where } from '../../QueryDescription'

export const forbiddenError = `Queries with joins, sortBy, take, skip, lokiTransform, Q.unsafeSqlExpr, Q.unsafeLokiExpr can't be encoded into a matcher`

const isEncodableWhere = (where: Where): boolean => {
  switch (where.type) {
    case 'where':
      return true
    case 'and':
    case 'or':
      return where.conditions.every(isEncodableWhere)
    default:
      return false
  }
}

export default function canEncodeMatcher(query: QueryDescription): boolean {
  const { joinTables, nestedJoinTables, sortBy, take, skip, lokiTransform, sql, where } = query

  return (
    !joinTables.length &&
    !nestedJoinTables.length &&
    !sortBy.length &&
    !take &&
    !skip &&
    !lokiTransform &&
    !sql &&
    where.every(isEncodableWhere)
  )
}
