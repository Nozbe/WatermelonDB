// @flow
/* eslint-disable no-use-before-define */

import {
  pipe,
  map,
  always,
  prop,
  has,
  propEq,
  T,
  head,
  length,
  ifElse,
  groupBy,
  values,
  partition,
} from 'rambdax'

// don't import whole `utils` to keep worker size small
import identical from '../../../../utils/fp/identical'
import objOf from '../../../../utils/fp/objOf'
import zip from '../../../../utils/fp/zip'
import cond from '../../../../utils/fp/cond'
import invariant from '../../../../utils/common/invariant'
import likeToRegexp from '../../../../utils/fp/likeToRegexp'

import type { AssociationArgs, SerializedQuery } from '../../../../Query'
import type {
  Operator,
  WhereDescription,
  On,
  And,
  Or,
  Where,
  ComparisonRight,
  Comparison,
  Clause,
  CompoundValue,
} from '../../../../QueryDescription'
import { type TableName, type ColumnName, columnName } from '../../../../Schema'
import type { AssociationInfo } from '../../../../Model'

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
  originalConditions: Where[], // Needed for column comparisons
  mapKey: ColumnName,
  joinKey: ColumnName,
}>

export type LokiQuery = $Exact<{
  table: TableName<any>,
  query: LokiRawQuery,
  hasJoins: boolean,
}>

const getComparisonRight: ComparisonRight => CompoundValue = (cond([
  [has('value'), prop('value')],
  [has('values'), prop('values')],
  [has('column'), () => invariant(false, 'Column comparisons unimplemented!')], // TODO: !!
]): any)

// TODO: It's probably possible to improve performance of those operators by making them
// binary-search compatible (i.e. don't use $and, $not)
// TODO: We might be able to use $jgt, $jbetween, etc. — but ensure the semantics are right
// and it won't break indexing

type OperatorFunction = CompoundValue => LokiRawQuery

const weakNotEqual: OperatorFunction = value => ({ $not: { $aeq: value } })

const noNullComparisons: OperatorFunction => OperatorFunction = operator => value => ({
  $and: [operator(value), weakNotEqual(null)],
})

const like: OperatorFunction = value => {
  if (typeof value === 'string') {
    return {
      $regex: likeToRegexp(value),
    }
  }

  return {}
}

const notLike: OperatorFunction = value => {
  if (typeof value === 'string') {
    return {
      $and: [{ $not: { $eq: null } }, { $not: { $regex: likeToRegexp(value) } }],
    }
  }

  return {}
}

const operators: { [Operator]: OperatorFunction } = {
  eq: objOf('$aeq'),
  notEq: weakNotEqual,
  gt: objOf('$gt'),
  gte: objOf('$gte'),
  weakGt: objOf('$gt'), // Note: this is correct (at least for as long as column comparisons happens via matchers)
  lt: noNullComparisons(objOf('$lt')),
  lte: noNullComparisons(objOf('$lte')),
  oneOf: objOf('$in'),
  notIn: noNullComparisons(objOf('$nin')),
  between: objOf('$between'),
  like,
  notLike,
}

const encodeComparison: Comparison => LokiRawQuery = ({ operator, right }) => {
  const comparisonRight = getComparisonRight(right)

  if (typeof comparisonRight === 'string') {
    // we can do fast path as we know that eq and aeq do the same thing for strings
    if (operator === 'eq') {
      return { $eq: comparisonRight }
    } else if (operator === 'notEq') {
      return { $ne: comparisonRight }
    }
  }
  return operators[operator](comparisonRight)
}

// HACK: Can't be `{}` or `undefined`, because that doesn't work with `or` conditions
const hackAlwaysTrueCondition: LokiRawQuery = { _fakeAlwaysTrue: { $eq: undefined } }

const encodeWhereDescription: (WhereDescription | On) => LokiRawQuery = ({ left, comparison }) =>
  // HACK: If this is a column comparison condition, ignore it (assume it evaluates to true)
  // The column comparison will actually be performed during the refining pass with a matcher func
  has('column', comparison.right)
    ? hackAlwaysTrueCondition
    : objOf(left, encodeComparison(comparison))

const typeEq = propEq('type')

const encodeCondition: (AssociationArgs[]) => Clause => LokiRawQuery = associations => clause =>
  (cond([
    [typeEq('and'), encodeAnd(associations)],
    [typeEq('or'), encodeOr(associations)],
    [typeEq('where'), encodeWhereDescription],
    [typeEq('on'), encodeWhereDescription],
  ]): any)(clause)

const encodeAndOr: LokiKeyword => (
  AssociationArgs[],
) => (And | Or) => LokiRawQuery = op => associations =>
  pipe(
    prop('conditions'),
    map(encodeCondition(associations)),
    objOf(op),
  )

const encodeAnd: (AssociationArgs[]) => And => LokiRawQuery = encodeAndOr('$and')
const encodeOr: (AssociationArgs[]) => Or => LokiRawQuery = encodeAndOr('$or')

const lengthEq = n =>
  pipe(
    length,
    identical(n),
  )

// Note: empty query returns `undefined` because
// Loki's Collection.count() works but count({}) doesn't
const concatRawQueries: (LokiRawQuery[]) => LokiRawQuery = (cond([
  [lengthEq(0), always(undefined)],
  [lengthEq(1), head],
  [T, objOf('$and')],
]): any)

const encodeConditions: (AssociationArgs[]) => (Where[]) => LokiRawQuery = associations =>
  pipe(
    conditions => {
      const [joins, wheres] = partition(clause => clause.type === 'on', conditions)
      const encodedJoins = encodeJoins(associations, (joins: any))
      const encodedWheres = wheres.map(encodeCondition(associations))
      return encodedJoins.concat(encodedWheres)
    },
    concatRawQueries,
  )

const encodeJoinConditions: (AssociationArgs[]) => (On[]) => LokiRawQuery = associations =>
  pipe(
    map(encodeCondition(associations)),
    concatRawQueries,
  )

const encodeMapKey: AssociationInfo => ColumnName = ifElse(
  propEq('type', 'belongs_to'),
  always(columnName('id')),
  prop('foreignKey'),
)

const encodeJoinKey: AssociationInfo => ColumnName = ifElse(
  propEq('type', 'belongs_to'),
  prop('key'),
  always(columnName('id')),
)

const encodeOriginalConditions: (On[]) => Where[] = map(({ left, comparison }) => ({
  type: 'where',
  left,
  comparison,
}))

const encodeJoin: (AssociationArgs[], AssociationArgs, On[]) => LokiRawQuery = (
  associations,
  [table, associationInfo],
  conditions,
) => ({
  $join: {
    table,
    query: encodeJoinConditions(associations)((conditions: any)),
    originalConditions: encodeOriginalConditions(conditions),
    mapKey: encodeMapKey(associationInfo),
    joinKey: encodeJoinKey(associationInfo),
  },
})

const groupByTable: (On[]) => On[][] = pipe(
  groupBy(prop('table')),
  values,
)

const zipAssociationsConditions: (AssociationArgs[], On[]) => [AssociationArgs, On[]][] = (
  associations,
  conditions,
) => zip(associations, groupByTable(conditions))

const encodeJoins: (AssociationArgs[], On[]) => LokiRawQuery[] = (associations, on) => {
  const conditions = zipAssociationsConditions(associations, on)
  return map(([association, _on]) => encodeJoin(associations, association, _on), conditions)
}

export default function encodeQuery(query: SerializedQuery): LokiQuery {
  const {
    table,
    description: { where, joinTables, sortBy, take },
    associations,
  } = query

  // TODO: implement support for Q.sortBy(), Q.take(), Q.skip() for Loki adapter
  invariant(!sortBy.length, '[WatermelonDB][Loki] Q.sortBy() not yet supported')
  invariant(!take, '[WatermelonDB][Loki] Q.take() not yet supported')

  return {
    table,
    query: encodeConditions(associations)(where),
    hasJoins: !!joinTables.length,
  }
}
