// @flow

import { contains } from 'rambdax'

import isDevelopment from 'utils/common/isDevelopment'
import invariant from 'utils/common/invariant'

import type Model from 'Model'

export opaque type TableName<+T: Model>: string = string
export opaque type ColumnName: string = string

export type ColumnType = 'string' | 'number' | 'bool'
export type ColumnSchema = $Exact<{
  name: ColumnName,
  type: ColumnType,
  isOptional?: boolean,
  isIndexed?: boolean,
}>

export type ColumnMap = { [name: ColumnName]: ColumnSchema }

export type TableSchemaSpec = $Exact<{ name: TableName<any>, columns: ColumnSchema[] }>

export type TableSchema = $Exact<{ name: TableName<any>, columns: ColumnMap }>

type TableMap = { [name: TableName<any>]: TableSchema }

export type SchemaVersion = number

export type AppSchema = $Exact<{ version: SchemaVersion, tables: TableMap }>

export function tableName<T: Model>(name: string): TableName<T> {
  return name
}

export function columnName(name: string): ColumnName {
  return name
}

export function appSchema({
  version,
  tables: tableList,
}: $Exact<{ version: number, tables: TableSchema[] }>): AppSchema {
  isDevelopment && invariant(version > 0, `Schema version must be greater than 0`)
  const tables: TableMap = tableList.reduce((map, table) => {
    map[table.name] = table
    return map
  }, {})

  return { version, tables }
}

export function validateColumnSchema(column: ColumnSchema): void {
  if (isDevelopment) {
    invariant(column.name, `Missing column name`)
    invariant(
      contains(column.type, ['string', 'bool', 'number']),
      `Invalid type ${column.type} for column ${column.name}`,
    )
    invariant(
      !contains(column.name, ['id', 'last_modified', '_changed', '_status']),
      `You must not define columns with name ${column.name}`,
    )
    if (column.name === 'created_at' || column.name === 'updated_at') {
      invariant(
        column.type === 'number' && !column.isOptional,
        `${column.name} must be of type number and not optional`,
      )
    }
  }
}

export function tableSchema({ name, columns: columnList }: TableSchemaSpec): TableSchema {
  isDevelopment && invariant(name, `Missing table name in schema`)
  const columns: ColumnMap = columnList.reduce((map, column) => {
    if (isDevelopment) {
      validateColumnSchema(column)
    }
    map[column.name] = column
    return map
  }, {})

  return { name, columns }
}
