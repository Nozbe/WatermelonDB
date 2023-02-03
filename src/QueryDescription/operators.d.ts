import type { TableName, ColumnName } from '../Schema'
import type { ArrayOrSpreadFn } from '../utils/fp'
import type {
  NonNullValue,
  NonNullValues,
  Value,
  ColumnDescription,
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

// function _valueOrColumn(arg: Value | ColumnDescription): ComparisonRight;

export function eq(valueOrColumn: Value | ColumnDescription): Comparison

// Not equal (weakly)
// Note:
// - (null != undefined) == false
// - (1 != true) == false
// - (0 != false) == false
export function notEq(valueOrColumn: Value | ColumnDescription): Comparison

// Greater than (SQLite semantics)
// Note:
// - (5 > null) == false
export function gt(valueOrColumn: NonNullValue | ColumnDescription): Comparison

// Greater than or equal (SQLite semantics)
// Note:
// - (5 >= null) == false
export function gte(valueOrColumn: NonNullValue | ColumnDescription): Comparison

// Greater than (JavaScript semantics)
// Note:
// - (5 > null) == true
export function weakGt(valueOrColumn: NonNullValue | ColumnDescription): Comparison

// Less than (SQLite semantics)
// Note:
// - (null < 5) == false
export function lt(valueOrColumn: NonNullValue | ColumnDescription): Comparison

// Less than or equal (SQLite semantics)
// Note:
// - (null <= 5) == false
export function lte(valueOrColumn: NonNullValue | ColumnDescription): Comparison

// Value in a set (SQLite IN semantics)
// Note:
// - `null` in `values` is not allowed!
export function oneOf(values: NonNullValues): Comparison

// Value not in a set (SQLite NOT IN semantics)
// Note:
// - `null` in `values` is not allowed!
// - (null NOT IN (1, 2, 3)) == false
export function notIn(values: NonNullValues): Comparison

// Number is between two numbers (greater than or equal left, and less than or equal right)
export function between(left: number, right: number): Comparison

export function like(value: string): Comparison

export function notLike(value: string): Comparison

export function sanitizeLikeString(value: string): string

export function includes(value: string): Comparison

export function column(name: ColumnName): ColumnDescription

export function where(left: ColumnName, valueOrComparison: Value | Comparison): WhereDescription

export function unsafeSqlExpr(sql: string): SqlExpr

export function unsafeLokiExpr(expr: any): LokiExpr

export function unsafeLokiTransform(fn: LokiTransformFunction): LokiTransform

export const and: ArrayOrSpreadFn<Where, And>
export const or: ArrayOrSpreadFn<Where, Or>

export const asc: SortOrder
export const desc: SortOrder

export function sortBy(sortColumn: ColumnName, sortOrder?: SortOrder): SortBy

export function take(count: number): Take

export function skip(count: number): Skip

// Note: we have to write out three separate meanings of OnFunction because of a Babel bug
// (it will remove the parentheses, changing the meaning of the flow type)
type _OnFunctionColumnValue = (
  tableName: TableName<any>,
  columnName: ColumnName,
  value: Value,
) => On
type _OnFunctionColumnComparison = (
  tableName: TableName<any>,
  columnName: ColumnName,
  comparison: Comparison,
) => On
type _OnFunctionWhere = (tableName: TableName<any>, where: Where) => On
type _OnFunctionWhereList = (tableName: TableName<any>, where: Where[]) => On

type OnFunction = _OnFunctionColumnValue &
  _OnFunctionColumnComparison &
  _OnFunctionWhere &
  _OnFunctionWhereList

// Use: on('tableName', 'left_column', 'right_value')
// or: on('tableName', 'left_column', gte(10))
// or: on('tableName', where('left_column', 'value')))
// or: on('tableName', or(...))
// or: on('tableName', [where(...), where(...)])
export const on: OnFunction

export function experimentalJoinTables(tables: TableName<any>[]): JoinTables

export function experimentalNestedJoin(from: TableName<any>, to: TableName<any>): NestedJoinTable

export function unsafeSqlQuery(sql: string, values?: Value[]): SqlQuery
