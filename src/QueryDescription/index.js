// @flow

import {
  propEq,
  is,
  has,
  any,
  values as getValues,
  complement,
  T,
  F,
  pipe,
  prop,
  uniq,
  map,
} from 'rambdax'

// don't import whole `utils` to keep worker size small
import cond from '../utils/fp/cond'
import partition from '../utils/fp/partition'
import isObject from '../utils/fp/isObject'
import invariant from '../utils/common/invariant'
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

export type ColumnDescription = $RE<{ column: ColumnName }>
export type ComparisonRight =
  | $RE<{ value: Value }>
  | $RE<{ values: NonNullValues }>
  | ColumnDescription
export type Comparison = $RE<{ operator: Operator, right: ComparisonRight }>

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
export type Condition = Where | On
export type QueryDescription = $RE<{ where: Where[], join: On[] }>

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
  if (arg !== null && typeof arg === 'object') {
    return arg
  }

  return { value: arg }
}

// Equals (weakly)
// Note:
// - (null == undefined) == true
// - (1 == true) == true
// - (0 == false) == true
export function eq(valueOrColumn: Value | ColumnDescription): Comparison {
  return { operator: 'eq', right: _valueOrColumn(valueOrColumn) }
}

// Not equal (weakly)
// Note:
// - (null != undefined) == false
// - (1 != true) == false
// - (0 != false) == false
export function notEq(valueOrColumn: Value | ColumnDescription): Comparison {
  return { operator: 'notEq', right: _valueOrColumn(valueOrColumn) }
}

// Greater than (SQLite semantics)
// Note:
// - (5 > null) == false
export function gt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'gt', right: _valueOrColumn(valueOrColumn) }
}

// Greater than or equal (SQLite semantics)
// Note:
// - (5 >= null) == false
export function gte(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'gte', right: _valueOrColumn(valueOrColumn) }
}

// Greater than (JavaScript semantics)
// Note:
// - (5 > null) == true
export function weakGt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'weakGt', right: _valueOrColumn(valueOrColumn) }
}

// Less than (SQLite semantics)
// Note:
// - (null < 5) == false
export function lt(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'lt', right: _valueOrColumn(valueOrColumn) }
}

// Less than or equal (SQLite semantics)
// Note:
// - (null <= 5) == false
export function lte(valueOrColumn: NonNullValue | ColumnDescription): Comparison {
  return { operator: 'lte', right: _valueOrColumn(valueOrColumn) }
}

// Value in a set (SQLite IN semantics)
// Note:
// - `null` in `values` is not allowed!
export function oneOf(values: NonNullValues): Comparison {
  if (process.env.NODE_ENV !== 'production') {
    invariant(Array.isArray(values), `argument passed to oneOf() is not an array`)
  }

  return { operator: 'oneOf', right: { values } }
}

// Value not in a set (SQLite NOT IN semantics)
// Note:
// - `null` in `values` is not allowed!
// - (null NOT IN (1, 2, 3)) == false
export function notIn(values: NonNullValues): Comparison {
  if (process.env.NODE_ENV !== 'production') {
    invariant(Array.isArray(values), `argument passed to notIn() is not an array`)
  }

  return { operator: 'notIn', right: { values } }
}

// Number is between two numbers (greater than or equal left, and less than or equal right)
export function between(left: number, right: number): Comparison {
  const values: number[] = [left, right]
  return { operator: 'between', right: { values } }
}

export function like(value: string): Comparison {
  return { operator: 'like', right: { value } }
}

export function notLike(value: string): Comparison {
  return { operator: 'notLike', right: { value } }
}

export function sanitizeLikeString(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '_')
}

export function column(name: ColumnName): ColumnDescription {
  return { column: name }
}

function _valueOrComparison(arg: Value | Comparison): Comparison {
  if (arg !== null && typeof arg === 'object') {
    return arg
  }

  return eq(arg)
}

export function where(left: ColumnName, valueOrComparison: Value | Comparison): WhereDescription {
  return { type: 'where', left, comparison: _valueOrComparison(valueOrComparison) }
}

export function and(...conditions: Where[]): And {
  return { type: 'and', conditions }
}

export function or(...conditions: Where[]): Or {
  return { type: 'or', conditions }
}

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
      table,
      left: leftOrWhereDescription,
      comparison: _valueOrComparison(valueOrComparison),
    }
  }

  const whereDescription: WhereDescription = (leftOrWhereDescription: any)

  return {
    type: 'on',
    table,
    left: whereDescription.left,
    comparison: whereDescription.comparison,
  }
}

const syncStatusColumn = columnName('_status')
const getJoins: (Condition[]) => [On[], Where[]] = (partition(propEq('type', 'on')): any)
const whereNotDeleted = where(syncStatusColumn, notEq('deleted'))
const joinsWithoutDeleted = pipe(
  map(prop('table')),
  uniq,
  map(table => on(table, syncStatusColumn, notEq('deleted'))),
)

export function buildQueryDescription(conditions: Condition[]): QueryDescription {
  const [join, whereConditions] = getJoins(conditions)

  return { join, where: whereConditions }
}

export function queryWithoutDeleted(query: QueryDescription): QueryDescription {
  const { join, where: whereConditions } = query

  return {
    join: [...join, ...joinsWithoutDeleted(join)],
    where: [...whereConditions, whereNotDeleted],
  }
}

const isNotObject = complement(isObject)

const searchForColumnComparisons: any => boolean = cond([
  [is(Array), any(value => searchForColumnComparisons(value))], // dig deeper into arrays
  [isNotObject, F], // bail if primitive value
  [has('column'), T], // bingo!
  [
    T,
    pipe(
      // dig deeper into objects
      getValues,
      any(value => searchForColumnComparisons(value)),
    ),
  ],
])

export function hasColumnComparisons(conditions: Where[]): boolean {
  return searchForColumnComparisons(conditions)
}
