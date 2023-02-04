// @flow
/* eslint-disable no-use-before-define */

// don't import whole `utils` to keep worker size small
import { unique } from '../utils/fp'
import invariant from '../utils/common/invariant'
import deepFreeze from '../utils/common/deepFreeze'
import { columnName } from '../Schema'

import type { Where, Clause, QueryDescription, On } from './type'
import { where, notEq } from './operators'

const acceptableClauses = ['where', 'and', 'or', 'on', 'sql', 'loki']
const isAcceptableClause = (clause: Where) => acceptableClauses.includes(clause.type)
export const validateConditions = (clauses: Where[]) => {
  if (process.env.NODE_ENV !== 'production') {
    invariant(
      clauses.every(isAcceptableClause),
      'Q.and(), Q.or(), Q.on() can only contain: Q.where, Q.and, Q.or, Q.on, Q.unsafeSqlExpr, Q.unsafeLokiExpr clauses',
    )
  }
}

const syncStatusColumn = columnName('_status')
const extractClauses: (Clause[]) => QueryDescription = (clauses) => {
  const query: $Exact<{ ...$Shape<QueryDescription> }> = {
    where: [],
    joinTables: [],
    nestedJoinTables: [],
    sortBy: [],
  }
  clauses.forEach((clause) => {
    switch (clause.type) {
      case 'where':
      case 'and':
      case 'or':
      case 'sql':
      case 'loki':
        query.where.push(clause)
        break
      case 'on': {
        const { table } = clause
        query.joinTables.push(table)
        query.where.push(clause)
        break
      }
      case 'sortBy':
        query.sortBy.push(clause)
        break
      case 'take':
        query.take = clause.count
        break
      case 'skip':
        query.skip = clause.count
        break
      case 'joinTables': {
        const { tables } = clause
        query.joinTables.push(...tables)
        break
      }
      case 'nestedJoinTable':
        query.nestedJoinTables.push({ from: clause.from, to: clause.to })
        break
      case 'lokiTransform':
        query.lokiTransform = clause.function
        break
      case 'sqlQuery':
        query.sql = clause
        if (process.env.NODE_ENV !== 'production') {
          invariant(
            clauses.every((_clause) =>
              ['sqlQuery', 'joinTables', 'nestedJoinTable'].includes(_clause.type),
            ),
            'Cannot use Q.unsafeSqlQuery with other clauses, except for Q.experimentalJoinTables and Q.experimentalNestedJoin (Did you mean Q.unsafeSqlExpr?)',
          )
        }
        break
      default:
        throw new Error('Invalid Query clause passed')
    }
  })
  query.joinTables = unique(query.joinTables)

  // $FlowFixMe: Flow is too dumb to realize that it is valid
  return query
}

export function buildQueryDescription(clauses: Clause[]): QueryDescription {
  const query = extractClauses(clauses)
  if (process.env.NODE_ENV !== 'production') {
    invariant(!(query.skip && !query.take), 'cannot skip without take')
    deepFreeze(query)
  }
  return query
}

const whereNotDeleted = where(syncStatusColumn, notEq('deleted'))

function conditionsWithoutDeleted(conditions: Where[]): Where[] {
  return conditions.map(queryWithoutDeletedImpl)
}

function queryWithoutDeletedImpl(clause: Where): Where {
  if (clause.type === 'and') {
    return { type: 'and', conditions: conditionsWithoutDeleted(clause.conditions) }
  } else if (clause.type === 'or') {
    return { type: 'or', conditions: conditionsWithoutDeleted(clause.conditions) }
  } else if (clause.type === 'on') {
    const onClause: On = clause
    return {
      type: 'on',
      table: onClause.table,
      conditions: conditionsWithoutDeleted(onClause.conditions).concat(whereNotDeleted),
    }
  }

  return clause
}

export function queryWithoutDeleted(query: QueryDescription): QueryDescription {
  const { where: whereConditions } = query

  const newQuery = {
    ...query,
    where: conditionsWithoutDeleted(whereConditions).concat(whereNotDeleted),
  }
  if (process.env.NODE_ENV !== 'production') {
    deepFreeze(newQuery)
  }
  return newQuery
}
