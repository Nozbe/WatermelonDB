// @flow

import { includes } from 'rambdax'

import logger from '../utils/common/logger'
import isDevelopment from '../utils/common/isDevelopment'
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
}>

export type ColumnMap = { [name: ColumnName]: ColumnSchema }

export type TableSchemaSpec = $Exact<{ name: TableName<any>, columns: ColumnSchema[] }>

export type TableSchema = $RE<{ name: TableName<any>, columns: ColumnMap }>

type TableMap = { [name: TableName<any>]: TableSchema }

export type SchemaVersion = number

export type AppSchema = $RE<{ version: SchemaVersion, tables: TableMap }>

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
    isDevelopment &&
      invariant(typeof table === 'object' && table.name, `Table schema must contain a name`)

    map[table.name] = table
    return map
  }, {})

  return { version, tables }
}

export function validateColumnSchema(column: ColumnSchema): void {
  if (isDevelopment) {
    invariant(column.name, `Missing column name`)
    invariant(
      includes(column.type, ['string', 'boolean', 'number']),
      `Invalid type ${column.type} for column ${column.name} (valid: string, boolean, number)`,
    )
    invariant(
      !includes(column.name, ['id', '_changed', '_status']),
      `You must not define a column with name ${column.name}`,
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

export function tableSchema({ name, columns: columnList }: TableSchemaSpec): TableSchema {
  isDevelopment && invariant(name, `Missing table name in schema`)
  const columns: ColumnMap = columnList.reduce((map, column) => {
    // TODO: `bool` is deprecated -- remove compat after a while
    if (column.type === 'bool') {
      column.type = 'boolean'
      if (isDevelopment) {
        logger.warn(
          `[DEPRECATION] Column type 'bool' is deprecated — change to 'boolean' (in ${JSON.stringify(
            column,
          )})`,
        )
      }
    }

    if (isDevelopment) {
      validateColumnSchema(column)
    }
    map[column.name] = column
    return map
  }, {})

  return { name, columns }
}
