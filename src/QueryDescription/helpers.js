// @flow
/* eslint-disable no-use-before-define */

// don't import whole `utils` to keep worker size small
import { unique } from '../utils/fp'
import invariant from '../utils/common/invariant'
import logger from '../utils/common/logger'
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

  // In the past, multiple separate top-level Q.ons were the only supported syntax and were automatically merged per-table to produce optimal code
  // We used to have a special case to avoid regressions, but it added complexity and had a side effect of rearranging the query suboptimally
  // We won't support this anymore, but will warn about suboptimal queries
  // TODO: Remove after 2022-01-01
  if (process.env.NODE_ENV !== 'production') {
    const onsEncountered: { [string]: boolean } = {}
    query.where.forEach((clause) => {
      if (clause.type === 'on') {
        const table = (clause.table: string)
        if (onsEncountered[table]) {
          logger.warn(
            `Found multiple Q.on('${table}', ...) clauses in a query. This is a performance bug - use a single Q.on('${table}', [condition1, condition1]) to produce a better performing query`,
          )
        }
        onsEncountered[table] = true
      }
    })
  }

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
