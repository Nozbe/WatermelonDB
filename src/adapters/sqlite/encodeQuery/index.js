// @flow
/* eslint-disable no-use-before-define */

import {pipe, pluck, flatten, uniq} from 'rambdax'
import type { SerializedQuery, AssociationArgs } from '../../../Query'
import type {
  NonNullValues,
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
import { type TableName, type ColumnName } from '../../../Schema'

import encodeValue from '../encodeValue'
import encodeName from '../encodeName'

function mapJoin<T>(array: T[], mapper: T => string, joiner: string): string {
  // NOTE: DO NOT try to optimize this by concatenating strings together. In non-JIT JSC,
  // concatenating strings is extremely slow (5000ms vs 120ms on 65K sample)
  return array.map(mapper).join(joiner)
}

const encodeValues: NonNullValues => string = values =>
  `(${mapJoin((values: any[]), encodeValue, ', ')})`

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
  like: 'like',
  notLike: 'not like',
}

const encodeComparison = (table: TableName<any>, comparison: Comparison) => {
  if (comparison.operator === 'between') {
    const { right } = comparison
    return right.values
      ? `between ${encodeValue(right.values[0])} and ${encodeValue(right.values[1])}`
      : ''
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
  selections: ColumnName[],
  countMode: boolean,
  needsDistinct: boolean,
): string => {
  if (countMode) {
    return needsDistinct
      ? `select count(distinct ${encodeName(table)}."id") as "count" from ${encodeName(table)}`
      : `select count(*) as "count" from ${encodeName(table)}`
  }

  const getSelectionQueryString = () => {
    if(!selections.length) {
      return `${encodeName(table)}.*`
    }
    return selections.map(column => `${encodeName(table)}.${encodeName(column)}`).join(', ')
  }

  return needsDistinct
    ? `select distinct ${getSelectionQueryString()} from ${encodeName(table)}`
    : `select ${getSelectionQueryString()} from ${encodeName(table)}`
}

const encodeAssociation: (TableName<any>) => AssociationArgs => string = mainTable => ([
  joinedTable,
  association,
]) =>
  association.type === 'belongs_to'
    ? ` join ${encodeName(joinedTable)} on ${encodeName(joinedTable)}."id" = ${encodeName(
        mainTable,
      )}.${encodeName(association.key)}`
    : ` join ${encodeName(joinedTable)} on ${encodeName(joinedTable)}.${encodeName(
        association.foreignKey,
      )} = ${encodeName(mainTable)}."id"`

const encodeJoin = (table: TableName<any>, associations: AssociationArgs[]): string =>
  associations.length ? associations.map(encodeAssociation(table)).join('') : ''

const encodeQuery = (query: SerializedQuery, countMode: boolean = false): string => {
  const { table, description } = query

  const hasJoins = !!query.description.join.length
  const associations = hasJoins ? query.associations : []
  const hasSelections = !!query.description.select.length
  const selections = hasSelections
    ? pipe(
        pluck('columns'),
        flatten,
        uniq,
      )(query.description.select)
    : []

  const hasToManyJoins = associations.some(([, association]) => association.type === 'has_many')

  const sql =
    encodeMethod(table, selections, countMode, hasToManyJoins) +
    encodeJoin(table, associations) +
    encodeConditions(table, description)

  return sql
}

export default encodeQuery
