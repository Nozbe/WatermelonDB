import type { $RE, $Exact } from '../../types'
import type {
  ColumnName,
  ColumnSchema,
  TableName,
  TableSchema,
  TableSchemaSpec,
  SchemaVersion,
} from '../index'

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

export type DestroyColumnMigrationStep = $RE<{
  type: 'destroy_column'
  table: TableName<any>
  column: ColumnName
  unsafeSql?: (_: string) => string
}>

export type RenameColumnMigrationStep = $RE<{
  type: 'rename_column'
  table: TableName<any>
  from: ColumnName
  to: ColumnName
  unsafeSql?: (_: string) => string
}>

export type DestroyTableMigrationStep = $RE<{
  type: 'destroy_table'
  table: TableName<any>
  unsafeSql?: (_: string) => string
}>

export type SqlMigrationStep = $RE<{
  type: 'sql'
  sql: string
}>

export type MigrationStep =
  | CreateTableMigrationStep
  | AddColumnsMigrationStep
  | SqlMigrationStep
  | DestroyColumnMigrationStep
  | RenameColumnMigrationStep
  | DestroyTableMigrationStep

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

export function destroyColumn({
  table,
  column,
  unsafeSql,
}: $Exact<{
  table: TableName<any>
  column: ColumnName
  unsafeSql?: (_: string) => string
}>): DestroyColumnMigrationStep

export function renameColumn({
  table,
  from,
  to,
  unsafeSql,
}: $Exact<{
  table: TableName<any>
  from: string
  to: string
  unsafeSql?: (_: string) => string
}>): RenameColumnMigrationStep

export function destroyTable({
  table,
  unsafeSql,
}: $Exact<{
  table: TableName<any>
  unsafeSql?: (_: string) => string
}>): DestroyTableMigrationStep

export function unsafeExecuteSql(sql: string): SqlMigrationStep
