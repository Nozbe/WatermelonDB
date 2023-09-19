import type { $RE, $Exact } from '../../types'
import { ColumnName } from '../index'
import type { ColumnSchema, TableName, TableSchema, TableSchemaSpec, SchemaVersion } from '../index'

export type CreateTableMigrationStep = $RE<{
  type: 'create_table'
  schema: TableSchema
}>

export type AddColumnsMigrationStep = $RE<{
  type: 'add_columns'
  table: TableName<any>
  columns: ColumnSchema[]
  unsafeSql?: (_: string) => string
}>

export type SqlMigrationStep = $RE<{
  type: 'sql'
  sql: string
}>

export type RenameColumnMigrationStep = $RE<{
  type: 'rename_column'
  table: TableName<any>
  from: ColumnName
  to: ColumnName
}>

export type MigrationStep =
  | CreateTableMigrationStep
  | AddColumnsMigrationStep
  | SqlMigrationStep
  | RenameColumnMigrationStep

type Migration = $RE<{
  toVersion: SchemaVersion
  steps: MigrationStep[]
}>

type SchemaMigrationsSpec = $RE<{
  migrations: Migration[]
}>

export type SchemaMigrations = $RE<{
  validated: true
  minVersion: SchemaVersion
  maxVersion: SchemaVersion
  sortedMigrations: Migration[]
}>

export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep

export function addColumns({
  table,
  columns,
  unsafeSql,
}: $Exact<{
  table: TableName<any>
  columns: ColumnSchema[]
  unsafeSql?: (_: string) => string
}>): AddColumnsMigrationStep

export function unsafeExecuteSql(sql: string): SqlMigrationStep

export function renameColumn({
  table,
  from,
  to,
}: $Exact<{
  table: TableName<any>
  from: string
  to: string
}>): RenameColumnMigrationStep
