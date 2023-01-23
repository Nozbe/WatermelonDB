// @flow

// NOTE: Only require files needed (critical path on web)
import invariant from '../utils/common/invariant'
import type { $Exact, $RE } from '../types'

import type Model from '../Model'

export type TableName<T extends Model> = string
export type ColumnName = string

export type ColumnType = 'string' | 'number' | 'boolean'
export type ColumnSchema = $RE<{
  name: ColumnName
  type: ColumnType
  isOptional?: boolean
  isIndexed?: boolean
}>

export type ColumnMap = { [name: ColumnName]: ColumnSchema }

export type TableSchemaSpec = $Exact<{
  name: TableName<any>
  columns: ColumnSchema[]
  unsafeSql?: (string) => string
}>

export type TableSchema = $RE<{
  name: TableName<any>
  // depending on operation, it's faster to use map or array
  columns: ColumnMap
  columnArray: ColumnSchema[]
  unsafeSql?: (string) => string
}>

type TableMap = { [name: TableName<any>]: TableSchema }

export type SchemaVersion = number

export type AppSchemaUnsafeSqlKind = 'setup' | 'create_indices' | 'drop_indices'

export type AppSchemaSpec = $Exact<{
  version: number
  tables: TableSchema[]
  unsafeSql?: (string, AppSchemaUnsafeSqlKind) => string
}>

export type AppSchema = $RE<{
  version: SchemaVersion
  tables: TableMap
  unsafeSql?: (string, AppSchemaUnsafeSqlKind) => string
}>

export function tableName<T extends Model>(name: string): TableName<T>

export function columnName(name: string): ColumnName

export function appSchema({ version, tables: tableList, unsafeSql }: AppSchemaSpec): AppSchema

export function validateColumnSchema(column: ColumnSchema): void

export function tableSchema({ name, columns: columnArray, unsafeSql }: TableSchemaSpec): TableSchema
