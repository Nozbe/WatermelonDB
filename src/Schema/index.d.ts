declare module '@nozbe/watermelondb/Schema' {
  import { Model } from '@nozbe/watermelondb'

  export type SchemaVersion = number

  export type TableName<T extends Model | void> = string
  export type ColumnName = string

  export function tableName<T extends Model>(name: string): TableName<T>

  export function columnName(name: string): ColumnName

  export type ColumnType = 'string' | 'number' | 'boolean'

  export interface ColumnSchema {
    name: ColumnName
    type: ColumnType
    isOptional?: boolean
    isIndexed?: boolean
    isFTS?: boolean
  }

  interface ColumnMap {
    [name: string]: ColumnSchema
  }

  export type TableSchemaSpec = { name: TableName<any>; columns: ColumnSchema[] }

  export interface TableSchema {
    name: TableName<any>
    columns: ColumnMap
  }

  interface TableMap {
    [name: string]: TableSchema
  }

  export interface AppSchema {
    version: number
    tables: TableMap
  }

  export function appSchema(options: { version: number; tables: TableSchema[] }): AppSchema

  export function tableSchema(options: TableSchemaSpec): TableSchema
}
