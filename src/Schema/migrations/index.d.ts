import type { $RE, $Exact } from '../../types'
import type { ColumnSchema, TableName, TableSchema, TableSchemaSpec, SchemaVersion } from '../index'

export type CreateTableMigrationStep = $RE<{
  type: 'create_table',
  schema: TableSchema,
}>

export type AddColumnsMigrationStep = $RE<{
  type: 'add_columns',
  table: TableName<any>,
  columns: ColumnSchema[],
  unsafeSql?: (string) => string,
}>

export type SqlMigrationStep = $RE<{
  type: 'sql',
  sql: string,
}>

export type MigrationStep = CreateTableMigrationStep | AddColumnsMigrationStep | SqlMigrationStep

type Migration = $RE<{
  toVersion: SchemaVersion,
  steps: MigrationStep[],
}>

type SchemaMigrationsSpec = $RE<{
  migrations: Migration[],
}>

export type SchemaMigrations = $RE<{
  validated: true,
  minVersion: SchemaVersion,
  maxVersion: SchemaVersion,
  sortedMigrations: Migration[],
}>

export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations;

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep;

export function addColumns({
  table,
  columns,
  unsafeSql,
}: $Exact<{
  table: TableName<any>,
  columns: ColumnSchema[],
  unsafeSql?: (string) => string,
}>): AddColumnsMigrationStep;

export function unsafeExecuteSql(sql: string): SqlMigrationStep;