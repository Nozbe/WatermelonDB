declare module '@nozbe/watermelondb/Schema' {
  import { Model } from "@nozbe/watermelondb";

  export type TableName<T extends Model> = string
  export type ColumnName = string

  export function tableName<T extends Model>(name: string): TableName<T>

  export function columnName(name: string): ColumnName

  export type ColumnType = 'string' | 'number' | 'bool'
  export type ColumnSchema = {
    name: ColumnName,
    type: ColumnType,
    isOptional?: boolean,
    isIndexed?: boolean,
  }

  type ColumnMap = { [name: string]: ColumnSchema }

  export type TableSchema = { name: TableName<any>, columns: ColumnMap }

  type TableMap = { [name: string]: TableSchema }

  export type AppSchema = { version: number, tables: TableMap }

  export function appSchema(options: {
    version: number,
    tables: TableSchema[],
  }): AppSchema

  export function tableSchema(options: {
    name: TableName<any>,
    columns: ColumnSchema[],
  }): TableSchema
}