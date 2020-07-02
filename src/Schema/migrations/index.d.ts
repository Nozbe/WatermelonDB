declare module '@nozbe/watermelondb/Schema/migrations' {
  import { SchemaVersion, TableName, ColumnMap, ColumnSchema, TableSchemaSpec } from "@nozbe/watermelondb/Schema";

  export interface SchemaMigrations {
    validated: true,
    minVersion: SchemaVersion,
    maxVersion: SchemaVersion,
    sortedMigrations: Migration[],
  }

  export interface CreateTableMigrationStep {
    type: 'create_table',
    name: TableName<any>,
    columns: ColumnMap,
  }

  export interface AddColumnsMigrationStep {
    type: 'add_columns',
    table: TableName<any>,
    columns: ColumnSchema[],
  }

  export type MigrationStep = CreateTableMigrationStep | AddColumnsMigrationStep

  export interface Migration {
    toVersion: SchemaVersion
    steps: MigrationStep[]
  }

  interface SchemaMigrationsSpec {
    migrations: Migration[],
  }

  export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations
  export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep
  export function addColumns({
    table,
    columns,
  }: { table: TableName<any>, columns: ColumnSchema[] }): AddColumnsMigrationStep
}
