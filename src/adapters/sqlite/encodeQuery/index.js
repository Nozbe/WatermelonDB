// @flow
/* eslint-disable no-use-before-define */

import type Query, { AssociationArgs } from '../../../Query'
import type {
  NonNullValue,
  Operator,
  Where,
  ComparisonRight,
  Comparison,
  On,
  And,
  Or,
  QueryDescription,
} from '../../../QueryDescription'
import * as Q from '../../../QueryDescription'
import { type TableName, type ColumnName } from '../../../schema'
import type Model from '../../../Model'

import encodeValue from '../encodeValue'
import encodeName from '../encodeName'

function mapJoin<T>(array: T[], mapper: T => string, joiner: string): string {
  return array.reduce(
    (string, value) => (string === '' ? mapper(value) : `${string}${joiner}${mapper(value)}`),
    '',
  )
}

function mapConcat<T>(array: T[], mapper: T => string): string {
  return array.reduce((string, value) => `${string}${mapper(value)}`, '')
}

const encodeValues: (NonNullValue[]) => string = values => `(${mapJoin(values, encodeValue, ', ')})`

const getComparisonRight = (table: TableName<any>, comparisonRight: ComparisonRight): string => {
  if (comparisonRight.values) {
    return encodeValues(comparisonRight.values)
  } else if (comparisonRight.column) {
    return `${encodeName(table)}.${encodeName(comparisonRight.column)}`
  }

  return typeof comparisonRight.value !== 'undefined' ? encodeValue(comparisonRight.value) : 'null'
}

// Note: it's necessary to use `is` / `is not` for NULL comparisons to work correctly
// See: https://sqlite.org/lang_expr.html
const operators: { [Operator]: string } = {
  eq: 'is',
  notEq: 'is not',
  gt: '>',
  gte: '>=',
  weakGt: '>', // For non-column comparison case
  lt: '<',
  lte: '<=',
  oneOf: 'in',
  notIn: 'not in',
  between: 'between',
}

const encodeComparison = (table: TableName<any>, comparison: Comparison) => {
  if (comparison.operator === 'between') {
    const { right } = comparison
    return right.values ?
      `between ${encodeValue(right.values[0])} and ${encodeValue(right.values[1])}` :
      ''
  }

  return `${operators[comparison.operator]} ${getComparisonRight(table, comparison.right)}`
}

const encodeWhere: (TableName<any>) => Where => string = table => where => {
  if (where.type === 'and') {
    return `(${encodeAndOr('and', table, where)})`
  } else if (where.type === 'or') {
    return `(${encodeAndOr('or', table, where)})`
  }

  return encodeWhereCondition(table, where.left, where.comparison)
}

const encodeWhereCondition = (
  table: TableName<any>,
  left: ColumnName,
  comparison: Comparison,
): string => {
  // if right operand is a value, we can use simple comparison
  // if a column, we must check for `not null > null`
  if (comparison.operator === 'weakGt' && comparison.right.column) {
    return encodeWhere(table)(
      Q.or(
        Q.where(left, Q.gt(comparison.right)),
        Q.and(Q.where(left, Q.notEq(null)), Q.where((comparison.right: any).column, null)),
      ),
    )
  }

  return `${encodeName(table)}.${encodeName(left)} ${encodeComparison(table, comparison)}`
}

const encodeAndOr = (op: string, table: TableName<any>, andOr: And | Or) => {
  if (andOr.conditions.length) {
    return mapJoin(andOr.conditions, encodeWhere(table), ` ${op} `)
  }
  return ''
}

const encodeOn: On => string = ({ table, left, comparison }) =>
  encodeWhereCondition(table, left, comparison)

const andJoiner = ' and '

const encodeConditions: (TableName<any>, QueryDescription) => string = (table, description) => {
  const wheres = mapJoin(description.where, encodeWhere(table), andJoiner)
  const joins = mapJoin(description.join, encodeOn, andJoiner)

  if (joins.length || wheres.length) {
    const joiner = wheres.length && joins.length ? andJoiner : ''
    return ` where ${joins}${joiner}${wheres}`
  }
  return ''
}

// If query contains `on()` conditions on tables with which the primary table has a has-many
// relation, then we need to add `distinct` on the query to ensure there are no duplicates
const encodeMethod = (
  table: TableName<any>,
  countMode: boolean,
  needsDistinct: boolean,
): string => {
  if (countMode) {
    return needsDistinct ?
      `select count(distinct ${encodeName(table)}."id") as "count" from ${encodeName(table)}` :
      `select count(*) as "count" from ${encodeName(table)}`
  }

  return needsDistinct ?
    `select distinct ${encodeName(table)}.* from ${encodeName(table)}` :
    `select ${encodeName(table)}.* from ${encodeName(table)}`
}

const encodeAssociation: (TableName<any>) => AssociationArgs => string = mainTable => ([
  joinedTable,
  association,
]) =>
  association.type === 'belongs_to' ?
    ` join ${encodeName(joinedTable)} on ${encodeName(joinedTable)}."id" = ${encodeName(
        mainTable,
      )}.${encodeName(association.key)}` :
    ` join ${encodeName(joinedTable)} on ${encodeName(joinedTable)}.${encodeName(
        association.foreignKey,
      )} = ${encodeName(mainTable)}."id"`

const encodeJoin = (table: TableName<any>, associations: AssociationArgs[]): string =>
  associations.length ? mapConcat(associations, encodeAssociation(table)) : ''

const encodeQuery = <T: Model>(query: Query<T>, countMode: boolean = false): string => {
  const { table, description } = query

  const hasJoins = !!query.description.join.length
  const associations = hasJoins ? query.associations : []

  const hasToManyJoins = associations.some(([, association]) => association.type === 'has_many')

  const sql =
    encodeMethod(table, countMode, hasToManyJoins) +
    encodeJoin(table, associations) +
    encodeConditions(table, description)

  return sql
}

export default encodeQuery
