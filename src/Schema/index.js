// @flow

import { contains } from 'rambdax'

import isDevelopment from 'utils/common/isDevelopment'
import invariant from 'utils/common/invariant'

import type Model from 'Model'

export opaque type TableName<+T: Model>: string = string
export opaque type ColumnName: string = string

export function tableName<T: Model>(name: string): TableName<T> {
  return name
}

export function columnName(name: string): ColumnName {
  return name
}

export type ColumnType = 'string' | 'number' | 'bool'
export type ColumnSchema = $Exact<{
  name: ColumnName,
  type: ColumnType,
  isOptional?: boolean,
  isIndexed?: boolean,
}>

type ColumnMap = { [name: ColumnName]: ColumnSchema }

export type TableSchema = $Exact<{ name: TableName<any>, columns: ColumnMap }>

type TableMap = { [name: TableName<any>]: TableSchema }

export type AppSchema = $Exact<{ version: number, tables: TableMap }>

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

export function tableSchema({
  name,
  columns: columnList,
}: $Exact<{ name: TableName<any>, columns: ColumnSchema[] }>): TableSchema {
  isDevelopment && invariant(name, `Missing table name in schema`)
  const columns: ColumnMap = columnList.reduce((map, column) => {
    if (isDevelopment) {
      invariant(column.name, `Missing column name in ${name} schema`)
      invariant(
        contains(column.type, ['string', 'bool', 'number']),
        `Invalid type ${column.type} for ${name}.${column.name}`,
      )
      invariant(
        !contains(column.name, ['id', 'last_modified', '_changed', '_status']),
        `You must not define columns with name ${column.name}`,
      )
      invariant(
        !contains(column.name, ['created_at', 'updated_at']) ||
          (column.type === 'number' && !column.isOptional),
        `${column.name} must be of type number and not optional`,
      )
    }
    map[column.name] = column
    return map
  }, {})

  return { name, columns }
}
