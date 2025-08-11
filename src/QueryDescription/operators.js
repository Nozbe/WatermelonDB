// @flow
/* eslint-disable no-use-before-define */

// don't import whole `utils` to keep worker size small
import invariant from '../utils/common/invariant'
import checkName from '../utils/fp/checkName'
import fromArrayOrSpread, { type ArrayOrSpreadFn } from '../utils/fp/arrayOrSpread'
import { type TableName, type ColumnName } from '../Schema'

import type {
  NonNullValue,
  NonNullValues,
  Value,
  ColumnDescription,
  ComparisonRight,
  Comparison,
  WhereDescription,
  SqlExpr,
  LokiExpr,
  Where,
  And,
  Or,
  On,
  SortOrder,
  SortBy,
  SortColumn,
  Take,
  Skip,
  JoinTables,
  NestedJoinTable,
  LokiTransformFunction,
  LokiTransform,
  SqlQuery,
} from './type'

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
  invariant(typeof value === 'string', 'Value passed to Q.like() is not a string')
  return { operator: 'like', right: { value }, type: comparisonSymbol }
}

export function notLike(value: string): Comparison {
  invariant(typeof value === 'string', 'Value passed to Q.notLike() is not a string')
  return { operator: 'notLike', right: { value }, type: comparisonSymbol }
}

const nonLikeSafeRegexp = /[^a-zA-Z0-9]/g

export function sanitizeLikeString(value: string): string {
  invariant(typeof value === 'string', 'Value passed to Q.sanitizeLikeString() is not a string')
  return value.replace(nonLikeSafeRegexp, '_')
}

export function includes(value: string): Comparison {
  invariant(typeof value === 'string', 'Value passed to Q.includes() is not a string')
  return { operator: 'includes', right: { value }, type: comparisonSymbol }
}

export function column(name: ColumnName): ColumnDescription {
  invariant(typeof name === 'string', 'Name passed to Q.column() is not a string')
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

export function unsafeSqlExpr(sql: string): SqlExpr {
  if (process.env.NODE_ENV !== 'production') {
    invariant(typeof sql === 'string', 'Value passed to Q.unsafeSqlExpr is not a string')
  }
  return { type: 'sql', expr: sql }
}

export function unsafeLokiExpr(expr: any): LokiExpr {
  if (process.env.NODE_ENV !== 'production') {
    invariant(
      expr && typeof expr === 'object' && !Array.isArray(expr),
      'Value passed to Q.unsafeLokiExpr is not an object',
    )
  }
  return { type: 'loki', expr }
}

export function unsafeLokiTransform(fn: LokiTransformFunction): LokiTransform {
  return { type: 'lokiTransform', function: fn }
}

export const and: ArrayOrSpreadFn<Where, And> = (...args): And => {
  const clauses = fromArrayOrSpread<Where>(args, 'Q.and()', 'Where')
  validateConditions(clauses)
  return { type: 'and', conditions: clauses }
}

export const or: ArrayOrSpreadFn<Where, Or> = (...args): Or => {
  const clauses = fromArrayOrSpread<Where>(args, 'Q.or()', 'Where')
  validateConditions(clauses)
  return { type: 'or', conditions: clauses }
}

export const asc: SortOrder = 'asc'
export const desc: SortOrder = 'desc'

export function sortBy(sortColumn: SortColumn, sortOrder: SortOrder = asc): SortBy {
  invariant(
    sortOrder === 'asc' || sortOrder === 'desc',
    `Invalid sortOrder argument received in Q.sortBy (valid: asc, desc)`,
  )
  
  const sortCol = typeof sortColumn === 'object' ? sortColumn.column : sortColumn
  const table = typeof sortColumn === 'object' ? sortColumn.table : undefined

  return { type: 'sortBy', sortColumn: checkName(sortCol), sortOrder, table }
}

export function take(count: number): Take {
  invariant(typeof count === 'number', 'Value passed to Q.take() is not a number')
  return { type: 'take', count }
}

export function skip(count: number): Skip {
  invariant(typeof count === 'number', 'Value passed to Q.skip() is not a number')
  return { type: 'skip', count }
}

// Note: we have to write out three separate meanings of OnFunction because of a Babel bug
// (it will remove the parentheses, changing the meaning of the flow type)
type _OnFunctionColumnValue = (TableName<any>, ColumnName, Value) => On
type _OnFunctionColumnComparison = (TableName<any>, ColumnName, Comparison) => On
type _OnFunctionWhere = (TableName<any>, Where) => On
type _OnFunctionWhereList = (TableName<any>, Where[]) => On

type OnFunction = _OnFunctionColumnValue &
  _OnFunctionColumnComparison &
  _OnFunctionWhere &
  _OnFunctionWhereList

// Use: on('tableName', 'left_column', 'right_value')
// or: on('tableName', 'left_column', gte(10))
// or: on('tableName', where('left_column', 'value')))
// or: on('tableName', or(...))
// or: on('tableName', [where(...), where(...)])
export const on: OnFunction = (table, leftOrClauseOrList, valueOrComparison) => {
  if (typeof leftOrClauseOrList === 'string') {
    invariant(valueOrComparison !== undefined, 'illegal `undefined` passed to Q.on')
    return on(table, [where(leftOrClauseOrList, valueOrComparison)])
  }

  const clauseOrList: Where | Where[] = (leftOrClauseOrList: any)

  if (Array.isArray(clauseOrList)) {
    const conditions: Where[] = clauseOrList
    validateConditions(conditions)
    return {
      type: 'on',
      table: checkName(table),
      conditions,
    }
  } else if (clauseOrList && clauseOrList.type === 'and') {
    return on(table, clauseOrList.conditions)
  }

  return on(table, [clauseOrList])
}

export function experimentalJoinTables(tables: TableName<any>[]): JoinTables {
  invariant(Array.isArray(tables), 'experimentalJoinTables expected an array')
  return { type: 'joinTables', tables: tables.map(checkName) }
}

export function experimentalNestedJoin(from: TableName<any>, to: TableName<any>): NestedJoinTable {
  return { type: 'nestedJoinTable', from: checkName(from), to: checkName(to) }
}

export function unsafeSqlQuery(sql: string, values: Value[] = []): SqlQuery {
  if (process.env.NODE_ENV !== 'production') {
    invariant(typeof sql === 'string', 'Value passed to Q.unsafeSqlQuery is not a string')
    invariant(
      Array.isArray(values),
      'Placeholder values passed to Q.unsafeSqlQuery are not an array',
    )
  }
  return { type: 'sqlQuery', sql, values }
}

const columnSymbol = Symbol('Q.column')
const comparisonSymbol = Symbol('QueryComparison')

function _valueOrColumn(arg: Value | ColumnDescription): ComparisonRight {
  if (arg === null || typeof arg !== 'object') {
    invariant(arg !== undefined, 'Cannot compare to undefined in a Query. Did you mean null?')
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

const acceptableClauses = ['where', 'and', 'or', 'on', 'sql', 'loki']
const isAcceptableClause = (clause: Where) => acceptableClauses.includes(clause.type)
const validateConditions = (clauses: Where[]) => {
  if (process.env.NODE_ENV !== 'production') {
    invariant(
      clauses.every(isAcceptableClause),
      'Q.and(), Q.or(), Q.on() can only contain: Q.where, Q.and, Q.or, Q.on, Q.unsafeSqlExpr, Q.unsafeLokiExpr clauses',
    )
  }
}
