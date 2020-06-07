declare module '@nozbe/watermelondb/QueryDescription' {
  import { ColumnName, TableName } from '@nozbe/watermelondb'

  export type NonNullValue = number | string | boolean
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

  export interface ColumnDescription {
    column: ColumnName
  }

  export type ComparisonRight = { value: Value } | { values: NonNullValue[] } | ColumnDescription

  export interface Comparison {
    operator: Operator
    right: ComparisonRight
  }

  export interface WhereDescription {
    type: 'where'
    left: ColumnName
    comparison: Comparison
  }

  export type Where = WhereDescription | And | Or
  export interface And {
    type: 'and'
    conditions: Where[]
  }
  export interface Or {
    type: 'or'
    conditions: Where[]
  }
  export interface On {
    type: 'on'
    table: TableName<any>
    left: ColumnName
    comparison: Comparison
  }
  export interface SortBy {
    type: 'sortBy'
    sortColumn: ColumnName
    sortOrder: SortOrder
  }
  export type SortOrder =
    | 'asc'
    | 'desc'
  export interface Take {
    type: 'take'
    count: number
  }
  export interface Skip = {
    type: 'skip'
    count: number
  }
  export type Clause = Where | On | SortBy | Take | Skip
  export interface QueryDescription {
    where: Where[]
    join: On[]
    sortBy: SortBy[]
    take?: Take
    skip?: Skip
  }

  export function eq(valueOrColumn: Value | ColumnDescription): Comparison
  export function notEq(valueOrColumn: Value | ColumnDescription): Comparison
  export function gt(valueOrColumn: NonNullValue | ColumnDescription): Comparison
  export function gte(valueOrColumn: NonNullValue | ColumnDescription): Comparison
  export function weakGt(valueOrColumn: NonNullValue | ColumnDescription): Comparison
  export function lt(valueOrColumn: NonNullValue | ColumnDescription): Comparison
  export function lte(valueOrColumn: NonNullValue | ColumnDescription): Comparison
  export function oneOf(values: NonNullValue[]): Comparison
  export function notIn(values: NonNullValue[]): Comparison
  export function between(left: number, right: number): Comparison
  export function column(name: ColumnName): ColumnDescription
  export function where(left: ColumnName, valueOrComparison: Value | Comparison): WhereDescription
  export function and(...conditions: Where[]): And
  export function or(...conditions: Where[]): Or
  export function like(value: string): Comparison
  export function notLike(value: string): Comparison
  export function sortBy(sortColumn: ColumnName, sortOrder?: SortOrder): SortBy
  export function take(count: number): Take
  export function skip(count: number): Skip
  export function sanitizeLikeString(value: string): string

  type _OnFunctionColumnValue = (table: TableName<any>, column: ColumnName, value: Value) => On
  type _OnFunctionColumnComparison = (
    table: TableName<any>,
    column: ColumnName,
    comparison: Comparison,
  ) => On
  type _OnFunctionWhereDescription = (table: TableName<any>, where: WhereDescription) => On

  type OnFunction = _OnFunctionColumnValue &
    _OnFunctionColumnComparison &
    _OnFunctionWhereDescription

  export const on: OnFunction

  export function buildQueryDescription(conditions: Clause[]): QueryDescription
  export function queryWithoutDeleted(query: QueryDescription): QueryDescription
  export function hasColumnComparisons(conditions: Where[]): boolean
}
