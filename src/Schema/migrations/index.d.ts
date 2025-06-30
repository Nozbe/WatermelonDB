declare module '@BuildHero/watermelondb/Schema/migrations' {
  import {
    SchemaVersion,
    TableName,
    ColumnMap,
    ColumnSchema,
    TableSchemaSpec,
    ColumnName,
  } from '@BuildHero/watermelondb/Schema'

  export interface SchemaMigrations {
    validated: true
    minVersion: SchemaVersion
    maxVersion: SchemaVersion
    sortedMigrations: Migration[]
  }

  export interface CreateFTS5TableMigrationStep {
    type: 'create_fts5_table'
    name: TableName<any>
    columns: ColumnName[]
    contentTable: TableName<any>
  }

  export interface DropFts5TableMigrationStep {
    type: 'drop_fts5_table'
    name: TableName<any>
  }

  export interface CreateTableMigrationStep {
    type: 'create_table'
    name: TableName<any>
    columns: ColumnMap
  }

  export interface AddColumnsMigrationStep {
    type: 'add_columns'
    table: TableName<any>
    columns: ColumnSchema[]
  }

  export interface DropTableMigrationStep {
    type: 'drop_table'
    table: TableName<any>
  }

  export interface DropColumnsMigrationStep {
    type: 'drop_columns'
    table: TableName<any>
    columns: string[]
  }

  export interface AddIndexMigrationStep {
    type: 'add_index'
    table: TableName<any>
    column: string
  }

  export interface RemoveIndexMigrationStep {
    type: 'remove_index'
    table: TableName<any>
    column: string
  }

  export type MigrationStep =
    | CreateTableMigrationStep
    | AddColumnsMigrationStep
    | DropTableMigrationStep
    | DropColumnsMigrationStep
    | AddIndexMigrationStep
    | RemoveIndexMigrationStep

  export interface Migration {
    toVersion: SchemaVersion
    steps: MigrationStep[]
  }

  interface SchemaMigrationsSpec {
    migrations: Migration[]
  }

  export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations
  export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep

  export function createFTS5Table({
    name,
    columns,
    contentTable,
  }: {
    name: TableName<any>
    columns: ColumnName[]
    contentTable: TableName<any>
  }): CreateFTS5TableMigrationStep

  export function dropFTS5Table({ name }: { name: TableName<any> }): DropFts5TableMigrationStep

  export function addColumns({
    table,
    columns,
  }: {
    table: TableName<any>
    columns: ColumnSchema[]
  }): AddColumnsMigrationStep

  export function dropTable({ table }: { table: TableName<any> }): DropTableMigrationStep

  export function dropColumns({
    table,
    columns,
  }: {
    table: TableName<any>
    columns: string[]
  }): DropColumnsMigrationStep

  export function addIndex({
    table,
    column,
  }: {
    table: TableName<any>
    column: string
  }): AddIndexMigrationStep

  export function removeIndex({
    table,
    column,
  }: {
    table: TableName<any>
    column: string
  }): RemoveIndexMigrationStep
}
