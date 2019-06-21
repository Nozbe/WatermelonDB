// @flow

import invariant from '../utils/common/invariant'
import type { $RE } from '../types'

import type Model from '../Model'

export opaque type TableName<+T: Model>: string = string
export opaque type ColumnName: string = string

export type ColumnType = 'string' | 'number' | 'boolean'
export type ColumnSchema = $RE<{
  name: ColumnName,
  type: ColumnType,
  isOptional?: boolean,
  isIndexed?: boolean,
  isSearchable?: boolean,
}>

export type ColumnMap = { [name: ColumnName]: ColumnSchema }

export type TableSchemaSpec = $Exact<{ name: TableName<any>, columns: ColumnSchema[] }>

export type TableSchema = $RE<{
  name: TableName<any>,
  // depending on operation, it's faster to use map or array
  columns: ColumnMap,
  columnArray: ColumnSchema[],
}>

type TableMap = { [name: TableName<any>]: TableSchema }

export type SchemaVersion = number

export type AppSchema = $RE<{ version: SchemaVersion, tables: TableMap }>

export function tableName<T: Model>(name: string): TableName<T> {
  return name
}

export function columnName(name: string): ColumnName {
  return name
}

const safeNameCharacters = /^[a-zA-Z_]\w*$/

export function appSchema({
  version,
  tables: tableList,
}: $Exact<{ version: number, tables: TableSchema[] }>): AppSchema {
  process.env.NODE_ENV !== 'production' &&
    invariant(version > 0, `Schema version must be greater than 0`)
  const tables: TableMap = tableList.reduce((map, table) => {
    if (process.env.NODE_ENV !== 'production') {
      invariant(typeof table === 'object' && table.name, `Table schema must contain a name`)
    }

    map[table.name] = table
    return map
  }, {})

  return { version, tables }
}

export function validateColumnSchema(column: ColumnSchema): void {
  if (process.env.NODE_ENV !== 'production') {
    invariant(column.name, `Missing column name`)
    invariant(
      ['string', 'boolean', 'number'].includes(column.type),
      `Invalid type ${column.type} for column ${column.name} (valid: string, boolean, number)`,
    )
    invariant(
      !['id', '_changed', '_status', '$loki'].includes(column.name),
      `You must not define a column with name ${column.name}`,
    )
    invariant(
      safeNameCharacters.test(column.name),
      `Column name (${
        column.name
      }) must contain only safe characters ${safeNameCharacters.toString()}`,
    )
    if (column.name === 'created_at' || column.name === 'updated_at') {
      invariant(
        column.type === 'number' && !column.isOptional,
        `${column.name} must be of type number and not optional`,
      )
    }
    if (column.name === 'last_modified') {
      invariant(
        column.type === 'number',
        `For compatibility reasons, column last_modified must be of type 'number', and should be optional`,
      )
    }
  }
}

export function tableSchema({ name, columns: columnArray }: TableSchemaSpec): TableSchema {
  if (process.env.NODE_ENV !== 'production') {
    invariant(name, `Missing table name in schema`)
    invariant(
      safeNameCharacters.test(name),
      `Table name ${name} must contain only safe characters ${safeNameCharacters.toString()}`,
    )
  }

  const columns: ColumnMap = columnArray.reduce((map, column) => {
    if (process.env.NODE_ENV !== 'production') {
      validateColumnSchema(column)
    }
    map[column.name] = column
    return map
  }, {})

  return { name, columns, columnArray }
}
