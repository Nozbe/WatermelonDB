// @flow

import { pipe, prop, uniq, map } from 'rambdax'

// don't import whole `utils` to keep worker size small
import invariant from '../utils/common/invariant'
import checkName from '../utils/fp/checkName'
import deepFreeze from '../utils/common/deepFreeze'
import type { $RE } from '../types'

import { type TableName, type ColumnName, columnName } from '../Schema'

export type NonNullValue = number | string | boolean
export type NonNullValues = number[] | string[] | boolean[]
export type Value = NonNullValue | null
export type CompoundValue = Value | Value[]

export type Operator =
  | 'eq'
  | 'notEq'
  | 'gt'
  | 'gte'
  | 'weakGt' // TODO: Do we still even need `gt`?
  | 'lt'
  | 'lte'
  | 'oneOf'
  | 'notIn'
  | 'between'
  | 'like'
  | 'notLike'

export type ColumnDescription = $RE<{ column: ColumnName, type?: Symbol }>
export type ComparisonRight =
  | $RE<{ value: Value }>
  | $RE<{ values: NonNullValues }>
  | ColumnDescription
export type Comparison = $RE<{ operator: Operator, right: ComparisonRight, type?: Symbol }>

export type WhereDescription = $RE<{
  type: 'where',
  left: ColumnName,
  comparison: Comparison,
}>

/* eslint-disable-next-line */
export type Where = WhereDescription | And | Or
export type And = $RE<{ type: 'and', conditions: Where[] }>
export type Or = $RE<{ type: 'or', conditions: Where[] }>
export type On = $RE<{
  type: 'on',
  table: TableName<any>,
  left: ColumnName,
  comparison: Comparison,
}>
export type SortOrder =
  | 'asc'
  | 'desc'
export const asc: SortOrder = 'asc'
export const desc: SortOrder = 'desc'
export type SortBy = $RE<{
  type: 'sortBy',
  sortColumn: ColumnName,
  sortOrder: SortOrder,
}>
export type Take = $RE<{
  type: 'take',
  count: number,
}>
export type Skip = $RE<{
  type: 'skip',
  count: number,
}>
export type Clause = Where | On | SortBy | Take | Skip
export type QueryDescription = $RE<{
  where: Where[],
  join: On[],
  sortBy: SortBy[],
  take: ?Take,
  skip: ?Skip,
}>

const columnSymbol = Symbol('Q.column')
const comparisonSymbol = Symbol('QueryComparison')

// Note: These operators are designed to match SQLite semantics
// to ensure that iOS, Android, web, and Query observation yield exactly the same results
//
// - `true` and `false` are equal to `1` and `0`
//   (JS uses true/false, but SQLite uses 1/0)
// - `null`, `undefined`, and missing fields are equal
//   (SQLite queries return null, but newly created records might lack fields)
// - You can only compare columns to values/other columns of the same type
//   (e.g. string to int comparisons are not allowed)
// - numeric comparisons (<, <=, >, >=, between) with null on either side always return false
//   e.g. `null < 2 == false`
// - `null` on the right-hand-side of IN/NOT IN is not allowed
//   e.g. `Q.in([null, 'foo', 'bar'])`
// - `null` on the left-hand-side of IN/NOT IN will always return false
//   e.g. `null NOT IN (1, 2, 3) == false`

function _valueOrColumn(arg: Value | ColumnDescription): ComparisonRight {
  if (arg === null || typeof arg !== 'object') {
    return { value: arg }
  }

  if (typeof arg.column === 'string') {
    invariant(
      arg.type === columnSymbol,
      'Invalid { column: } object passed to Watermelon query. You seem to be passing unsanitized user data to Query builder!',
    )
    return { column: arg.column }
  }

  throw new Error(`Invalid value passed to query`)
}

// Equals (weakly)
// Note:
// - (null == undefined) == true
// - (1 == true) == true
// - (0 == false) == true
export function eq(valueOrColumn: Value | ColumnDescription): Comparison {
  return { operator: 'eq', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Not equal (weakly)
// Note:
// - (null != undefined) == false
// - (1 != true) == false
// - (0 != false) == false
export function notEq(valueOrColumn: Value | ColumnDescription): Comparison {
  return { operator: 'notEq', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Greater than (SQLite semantics)
// Note:
// - (5 > null) == false
export function gt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'gt', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Greater than or equal (SQLite semantics)
// Note:
// - (5 >= null) == false
export function gte(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'gte', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Greater than (JavaScript semantics)
// Note:
// - (5 > null) == true
export function weakGt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'weakGt', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Less than (SQLite semantics)
// Note:
// - (null < 5) == false
export function lt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'lt', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Less than or equal (SQLite semantics)
// Note:
// - (null <= 5) == false
export function lte(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'lte', right: _valueOrColumn(valueOrColumn), type: comparisonSymbol }
}

// Value in a set (SQLite IN semantics)
// Note:
// - `null` in `values` is not allowed!
export function oneOf(values: NonNullValues): Comparison {
  invariant(Array.isArray(values), `argument passed to oneOf() is not an array`)
  Object.freeze(values) // even in production, because it's an easy mistake to make

  return { operator: 'oneOf', right: { values }, type: comparisonSymbol }
}

// Value not in a set (SQLite NOT IN semantics)
// Note:
// - `null` in `values` is not allowed!
// - (null NOT IN (1, 2, 3)) == false
export function notIn(values: NonNullValues): Comparison {
  invariant(Array.isArray(values), `argument passed to notIn() is not an array`)
  Object.freeze(values) // even in production, because it's an easy mistake to make

  return { operator: 'notIn', right: { values }, type: comparisonSymbol }
}

// Number is between two numbers (greater than or equal left, and less than or equal right)
export function between(left: number, right: number): Comparison {
  invariant(
    typeof left === 'number' && typeof right === 'number',
    'Values passed to Q.between() are not numbers',
  )
  const values: number[] = [left, right]
  return { operator: 'between', right: { values }, type: comparisonSymbol }
}

export function like(value: string): Comparison {
  invariant(typeof value === 'string', 'Value passed to Q.like() is not string')
  return { operator: 'like', right: { value }, type: comparisonSymbol }
}

export function notLike(value: string): Comparison {
  invariant(typeof value === 'string', 'Value passed to Q.notLike() is not string')
  return { operator: 'notLike', right: { value }, type: comparisonSymbol }
}

const nonLikeSafeRegexp = /[^a-zA-Z0-9]/g

export function sanitizeLikeString(value: string): string {
  invariant(typeof value === 'string', 'Value passed to Q.sanitizeLikeString() is not string')
  return value.replace(nonLikeSafeRegexp, '_')
}

export function column(name: ColumnName): ColumnDescription {
  invariant(typeof name === 'string', 'Name passed to Q.column() is not string')
  return { column: checkName(name), type: columnSymbol }
}

function _valueOrComparison(arg: Value | Comparison): Comparison {
  if (arg === null || typeof arg !== 'object') {
    return _valueOrComparison(eq(arg))
  }

  invariant(
    arg.type === comparisonSymbol,
    'Invalid Comparison passed to Query builder. You seem to be passing unsanitized user data to Query builder!',
  )
  const { operator, right } = arg
  return { operator, right }
}

export function where(left: ColumnName, valueOrComparison: Value | Comparison): WhereDescription {
  return { type: 'where', left: checkName(left), comparison: _valueOrComparison(valueOrComparison) }
}

export function and(...conditions: Where[]): And {
  return { type: 'and', conditions }
}

export function or(...conditions: Where[]): Or {
  return { type: 'or', conditions }
}

function sortBy(sortColumn: ColumnName, sortOrder: SortOrder = asc): SortBy {
  return { type: 'sortBy', sortColumn, sortOrder }
}

function take(count: number): Take {
  return { type: 'take', count }
}

function skip(count: number): Skip {
  return { type: 'skip', count }
}

export { sortBy as experimentalSortBy, take as experimentalTake, skip as experimentalSkip }

// Note: we have to write out three separate meanings of OnFunction because of a Babel bug
// (it will remove the parentheses, changing the meaning of the flow type)
type _OnFunctionColumnValue = (TableName<any>, ColumnName, Value) => On
type _OnFunctionColumnComparison = (TableName<any>, ColumnName, Comparison) => On
type _OnFunctionWhereDescription = (TableName<any>, WhereDescription) => On

type OnFunction = _OnFunctionColumnValue & _OnFunctionColumnComparison & _OnFunctionWhereDescription

// Use: on('tableName', 'left_column', 'right_value')
// or: on('tableName', 'left_column', gte(10))
// or: on('tableName', where('left_column', 'value')))
export const on: OnFunction = (table, leftOrWhereDescription, valueOrComparison) => {
  if (typeof leftOrWhereDescription === 'string') {
    invariant(valueOrComparison !== undefined, 'illegal `undefined` passed to Q.on')
    return {
      type: 'on',
      table: checkName(table),
      left: leftOrWhereDescription,
      comparison: _valueOrComparison(valueOrComparison),
    }
  }

  const whereDescription: WhereDescription = (leftOrWhereDescription: any)

  return {
    type: 'on',
    table: checkName(table),
    left: whereDescription.left,
    comparison: whereDescription.comparison,
  }
}

const syncStatusColumn = columnName('_status')
const extractClauses: (Clause[]) => QueryDescription = clauses => {
  const clauseMap = { join: [], sortBy: [], where: [], take: null, skip: null }
  clauses.forEach(cond => {
    let { type } = cond
    switch (type) {
      case 'take':
      case 'skip':
        // $FlowFixMe: Flow is too dumb to realize that it is valid
        clauseMap[type] = cond
        break
      default:
      case 'where':
        type = 'where'
        // fallthrough
      case 'on':
        if (type === 'on') type = 'join'
        // fallthrough
      case 'sortBy':
        clauseMap[type].push(cond)
        break
    }
  })
  // $FlowFixMe: Flow is too dumb to realize that it is valid
  return clauseMap
}
const whereNotDeleted = where(syncStatusColumn, notEq('deleted'))
const joinsWithoutDeleted = pipe(
  map(prop('table')),
  uniq,
  map(table => on(table, syncStatusColumn, notEq('deleted'))),
)

export function buildQueryDescription(clauses: Clause[]): QueryDescription {
  const clauseMap = extractClauses(clauses)

  invariant(!(clauseMap.skip && !clauseMap.take), 'cannot skip without take')

  const query = clauseMap
  if (process.env.NODE_ENV !== 'production') {
    deepFreeze(query)
  }
  return query
}

export function queryWithoutDeleted(query: QueryDescription): QueryDescription {
  const { join, where: whereConditions } = query

  const newQuery = {
    ...query,
    join: [...join, ...joinsWithoutDeleted(join)],
    where: [...whereConditions, whereNotDeleted],
  }
  if (process.env.NODE_ENV !== 'production') {
    deepFreeze(newQuery)
  }
  return newQuery
}

const searchForColumnComparisons: any => boolean = value => {
  // Performance critical (100ms on login in previous rambdax-based implementation)

  if (Array.isArray(value)) {
    // dig deeper into the array
    for (let i = 0; i < value.length; i += 1) {
      if (searchForColumnComparisons(value[i])) {
        return true
      }
    }
    return false
  } else if (value && typeof value === 'object') {
    if (value.column) {
      return true // bingo!
    }
    // drill deeper into the object
    // eslint-disable-next-line no-restricted-syntax
    for (const key in value) {
      // NOTE: To be safe against JS edge cases, there should be hasOwnProperty check
      // but this is performance critical so we trust that this is only called with
      // QueryDescription which doesn't need that
      if (key !== 'values' && searchForColumnComparisons(value[key])) {
        return true
      }
    }
    return false
  }

  // primitive value
  return false
}

export function hasColumnComparisons(conditions: Where[]): boolean {
  // since we don't do hasOwnProperty check, let's make sure Object prototype isn't broken
  let isBroken = false
  // eslint-disable-next-line
  for (const _ in {}) {
    isBroken = true
  }
  invariant(
    !isBroken,
    'Broken Object prototype! You must not have properties defined on Object prototype',
  )
  return searchForColumnComparisons(conditions)
}
