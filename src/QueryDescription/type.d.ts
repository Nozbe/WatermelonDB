import type { $RE } from '../types'

import type { ColumnName, TableName } from '../Schema'

export type NonNullValue = number | string | boolean
export type NonNullValues = number[] | string[] | boolean[]
export type Value = NonNullValue | null
export type CompoundValue = Value | Value[]

export type Operator =
  | 'eq'
  | 'notEq'
  | 'gt'
  | 'gte'
  | 'weakGt'
  | 'lt'
  | 'lte'
  | 'oneOf'
  | 'notIn'
  | 'between'
  | 'like'
  | 'notLike'
  | 'includes'

export type ColumnDescription = $RE<{ column: ColumnName; type?: symbol }>
export type ComparisonRight =
  | $RE<{ value: Value }>
  | $RE<{ values: NonNullValues }>
  | ColumnDescription
export type Comparison = $RE<{ operator: Operator; right: ComparisonRight; type?: symbol }>

export type WhereDescription = $RE<{
  type: 'where'
  left: ColumnName
  comparison: Comparison
}>

export type SqlExpr = $RE<{ type: 'sql'; expr: string }>
export type LokiExpr = $RE<{ type: 'loki'; expr: any }>

// eslint-disable-next-line no-use-before-define
export type Where = WhereDescription | And | Or | On | SqlExpr | LokiExpr
export type And = $RE<{ type: 'and'; conditions: Where[] }>
export type Or = $RE<{ type: 'or'; conditions: Where[] }>
export type On = $RE<{
  type: 'on'
  table: TableName<any>
  conditions: Where[]
}>
export type SortOrder = 'asc' | 'desc'
export const asc: SortOrder
export const desc: SortOrder
export type SortBy = $RE<{
  type: 'sortBy'
  sortColumn: ColumnName
  sortOrder: SortOrder
}>
export type Take = $RE<{
  type: 'take'
  count: number
}>
export type Skip = $RE<{
  type: 'skip'
  count: number
}>
export type JoinTables = $RE<{
  type: 'joinTables'
  tables: Array<TableName<any>>
}>
export type NestedJoinTable = $RE<{
  type: 'nestedJoinTable'
  from: TableName<any>
  to: TableName<any>
}>
export type LokiTransformFunction = (rawLokiRecords: any[], loki: any) => any[]
export type LokiTransform = $RE<{
  type: 'lokiTransform'
  function: LokiTransformFunction
}>
export type SqlQuery = $RE<{
  type: 'sqlQuery'
  sql: string
  values: Value[]
}>
export type Clause =
  | Where
  | SortBy
  | Take
  | Skip
  | JoinTables
  | NestedJoinTable
  | LokiTransform
  | SqlQuery

type NestedJoinTableDef = $RE<{ from: TableName<any>; to: TableName<any> }>
export type QueryDescription = $RE<{
  where: Where[]
  joinTables: Array<TableName<any>>
  nestedJoinTables: NestedJoinTableDef[]
  sortBy: SortBy[]
  take?: number
  skip?: number
  lokiTransform?: LokiTransformFunction
  sql?: SqlQuery
}>
