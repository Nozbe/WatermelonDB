// @flow
/* eslint-disable no-use-before-define */

// don't import whole `utils` to keep worker size small
import invariant from '../../../../utils/common/invariant'
import likeToRegexp from '../../../../utils/fp/likeToRegexp'

import type { QueryAssociation, SerializedQuery } from '../../../../Query'
import type {
  Operator,
  WhereDescription,
  On,
  And,
  Or,
  Where,
  Clause,
  Comparison,
} from '../../../../QueryDescription'
import { type TableName, type ColumnName } from '../../../../Schema'

export type LokiRawQuery = Object | typeof undefined
type LokiOperator =
  | '$aeq'
  | '$eq'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$ne'
  | '$in'
  | '$nin'
  | '$between'
  | '$regex'
type LokiKeyword = LokiOperator | '$and' | '$or'

export type LokiJoin = $Exact<{
  table: TableName<any>,
  query: LokiRawQuery,
  mapKey: ColumnName,
  joinKey: ColumnName,
}>

export type LokiQuery = $Exact<{
  table: TableName<any>,
  query: LokiRawQuery,
  hasJoins: boolean,
}>

const weakNotNull = { $not: { $aeq: null } }

const encodeComparison = (comparison: Comparison, value: any): LokiRawQuery => {
  // TODO: It's probably possible to improve performance of those operators by making them
  // binary-search compatible (i.e. don't use $and, $not)
  // TODO: We might be able to use $jgt, $jbetween, etc. — but ensure the semantics are right
  // and it won't break indexing

  const { operator } = comparison

  if (comparison.right.column) {
    // Encode for column comparisons
    switch (operator) {
      case 'eq':
        return { $$aeq: value }
      case 'notEq':
        return { $not: { $$aeq: value } }
      case 'gt':
        return { $$gt: value }
      case 'gte':
        return { $$gte: value }
      case 'weakGt':
        return { $$gt: value }
      case 'lt':
        return { $and: [{ $$lt: value }, weakNotNull] }
      case 'lte':
        return { $and: [{ $$lte: value }, weakNotNull] }
      default:
        throw new Error(`Illegal operator ${operator} for column comparisons`)
    }
  } else {
    switch (operator) {
      case 'eq':
        return { $aeq: value }
      case 'notEq':
        return { $not: { $aeq: value } }
      case 'gt':
        return { $gt: value }
      case 'gte':
        return { $gte: value }
      case 'weakGt':
        return { $gt: value } // Note: yup, this is correct (for non-column comparisons)
      case 'lt':
        return { $and: [{ $lt: value }, weakNotNull] }
      case 'lte':
        return { $and: [{ $lte: value }, weakNotNull] }
      case 'oneOf':
        return { $in: value }
      case 'notIn':
        return { $and: [{ $nin: value }, weakNotNull] }
      case 'between':
        return { $between: value }
      case 'like':
        return {
          $regex: likeToRegexp(value),
        }
      case 'notLike':
        return {
          $and: [{ $not: { $eq: null } }, { $not: { $regex: likeToRegexp(value) } }],
        }
      default:
        throw new Error(`Unknown operator ${operator}`)
    }
  }
}

const columnCompRequiresColumnNotNull: { [$FlowFixMe<Operator>]: boolean } = {
  gt: true,
  gte: true,
  lt: true,
  lte: true,
}

const encodeWhereDescription: (WhereDescription) => LokiRawQuery = ({ left, comparison }) => {
  const { operator, right } = comparison
  const col: string = left
  // $FlowFixMe - NOTE: order of ||s is important here, since .value can be falsy, but .column and .values are either truthy or are undefined
  const comparisonRight: any = right.column || right.values || right.value

  if (typeof right.value === 'string') {
    // we can do fast path as we know that eq and aeq do the same thing for strings
    if (operator === 'eq') {
      return { [col]: { $eq: comparisonRight } }
    } else if (operator === 'notEq') {
      return { [col]: { $ne: comparisonRight } }
    }
  }
  const colName: ?string = (right: any).column
  const encodedComparison = encodeComparison(comparison, comparisonRight)

  if (colName && columnCompRequiresColumnNotNull[operator]) {
    return { $and: [{ [col]: encodedComparison }, { [colName]: weakNotNull }] }
  }
  return { [col]: encodedComparison }
}

const encodeCondition: (QueryAssociation[]) => (Clause) => LokiRawQuery = (associations) => (
  clause,
) => {
  switch (clause.type) {
    case 'and':
      return encodeAnd(associations, clause)
    case 'or':
      return encodeOr(associations, clause)
    case 'where':
      return encodeWhereDescription(clause)
    case 'on':
      return encodeJoin(associations, clause)
    case 'loki':
      return clause.expr
    default:
      throw new Error(`Unknown clause ${clause.type}`)
  }
}

const encodeConditions: (QueryAssociation[], Where[]) => LokiRawQuery[] = (
  associations,
  conditions,
) => conditions.map(encodeCondition(associations))

const encodeAndOr = (op: LokiKeyword) => (
  associations: QueryAssociation[],
  clause: And | Or,
): LokiRawQuery => {
  const conditions = encodeConditions(associations, clause.conditions)
  // flatten
  return conditions.length === 1
    ? conditions[0]
    : // $FlowFixMe
      { [op]: conditions }
}

const encodeAnd: (QueryAssociation[], And) => LokiRawQuery = encodeAndOr('$and')
const encodeOr: (QueryAssociation[], Or) => LokiRawQuery = encodeAndOr('$or')

// Note: empty query returns `undefined` because
// Loki's Collection.count() works but count({}) doesn't
const concatRawQueries = (queries: LokiRawQuery[]): LokiRawQuery => {
  switch (queries.length) {
    case 0:
      return undefined
    case 1:
      return queries[0]
    default:
      return { $and: queries }
  }
}

const encodeRootConditions: (QueryAssociation[], Where[]) => LokiRawQuery = (
  associations,
  conditions,
) => concatRawQueries(encodeConditions(associations, conditions))

const encodeJoin = (associations: QueryAssociation[], on: On): LokiRawQuery => {
  const { table, conditions } = on
  const association = associations.find(({ to }) => table === to)
  invariant(
    association,
    'To nest Q.on inside Q.and/Q.or you must explicitly declare Q.experimentalJoinTables at the beginning of the query',
  )
  const { info } = association
  return {
    $join: {
      table,
      query: encodeRootConditions(associations, (conditions: any)),
      mapKey: info.type === 'belongs_to' ? 'id' : info.foreignKey,
      joinKey: info.type === 'belongs_to' ? info.key : 'id',
    },
  }
}

export default function encodeQuery(query: SerializedQuery): LokiQuery {
  const {
    table,
    description: { where, joinTables, sortBy, take },
    associations,
  } = query

  // TODO: implement support for Q.sortBy(), Q.take(), Q.skip() for Loki adapter
  invariant(!sortBy.length, '[Loki] Q.sortBy() not yet supported')
  invariant(!take, '[Loki] Q.take() not yet supported')

  return {
    table,
    query: encodeRootConditions(associations, where),
    hasJoins: !!joinTables.length,
  }
}
