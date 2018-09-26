// @flow

import type { ColumnSchema, TableName, ColumnMap, TableSchemaSpec } from 'Schema'
import { tableSchema } from 'Schema'

type CreateTableMigrationStep = $Exact<{
  +type: 'create_table',
  +name: TableName<any>,
  +columns: ColumnMap,
}>

type AddColumnMigrationStep = $Exact<{
  +type: 'add_column',
  +table: TableName<any>,
  +column: ColumnSchema,
}>

type MigrationStep = CreateTableMigrationStep | AddColumnMigrationStep

type SchemaVersion = number

type Migration = $Exact<{
  +from: SchemaVersion,
  +to: SchemaVersion,
  +changes: MigrationStep[],
}>

type SchemaMigrations = $Exact<{
  +minimumVersion: SchemaVersion,
  +currentVersion: SchemaVersion,
  +migrations: Migration[],
}>

// Creates a specification of how to migrate between different versions of
// database schema. Every time you change the database schema, you must
// create a corresponding migration.
//
// See docs for more details
//
// Example:
//
// schemaMigrations({
//   minimumVersion: 1,
//   currentVersion: 3,
//   migrations: [
//     {
//       from: 2,
//       to: 3,
//       changes: [
//         addColumn({
//           table: 'posts',
//           column: { name: 'subtitle', type: 'string', isOptional: true },
//         }),
//         createTable({
//           name: 'comments',
//           columns: [
//             { name: 'post_id', type: 'string', isIndexed: true },
//             { name: 'body', type: 'string' },
//           ],
//         }),
//       ],
//     },
//     {
//       from: 1,
//       to: 2,
//       changes: [
//         // ...
//       ],
//     },
//   ],
// })

export function schemaMigrations(migrationSpec: SchemaMigrations): SchemaMigrations {
  // TODO: development invariants
  return migrationSpec
}

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep {
  const { name, columns } = tableSchema(tableSchemaSpec)
  return { type: 'create_table', name, columns }
}

export function addColumn({
  table,
  column,
}: $Exact<{ table: TableName<any>, column: ColumnSchema }>): AddColumnMigrationStep {
  return { type: 'add_column', table, column }
}

/*

TODO: Those types of migrations are currently not implemented. If you need them, feel free to contribute!

// table operations
destroyTable('table_name')
renameTable({ from: 'old_table_name', to: 'new_table_name' })

// column operations
renameColumn({ table: 'table_name', from: 'old_column_name', to: 'new_column_name' })
destroyColumn({ table: 'table_name', column: 'column_name' })

// indexing
addColumnIndex({ table: 'table_name', column: 'column_name' })
removeColumnIndex({ table: 'table_name', column: 'column_name' })

// optionality
makeColumnOptional({ table: 'table_name', column: 'column_name' }) // allows nulls now
makeColumnRequired({ table: 'table_name', column: 'column_name' }) // nulls are changed to null value ('', 0, false)

*/
