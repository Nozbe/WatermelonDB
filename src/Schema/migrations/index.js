// @flow

import type { ColumnSchema, TableName, ColumnMap, TableSchemaSpec, SchemaVersion } from '../index'
import { tableSchema, validateColumnSchema } from '../index'

import { isDevelopment, invariant } from '../../utils/common'
import { isObject } from '../../utils/fp'

export type CreateTableMigrationStep = $Exact<{
  +type: 'create_table',
  +name: TableName<any>,
  +columns: ColumnMap,
}>

export type AddColumnsMigrationStep = $Exact<{
  +type: 'add_columns',
  +table: TableName<any>,
  +columns: ColumnSchema[],
}>

export type MigrationStep = CreateTableMigrationStep | AddColumnsMigrationStep

type Migration = $Exact<{
  +version: SchemaVersion,
  +steps: MigrationStep[],
}>

type SchemaMigrationsSpec = $Exact<{
  +migrations: Migration[],
}>

export type SchemaMigrations = $Exact<{
  +validated: true,
  ...SchemaMigrationsSpec,
}>

// Creates a specification of how to migrate between different versions of
// database schema. Every time you change the database schema, you must
// create a corresponding migration.
//
// Note that migrations must be listed in reverse chronological order
// (migration to newest version at the top)
//
// See docs for more details
//
// Example:
//
// schemaMigrations({
//   migrations: [
//     {
//       version: 3,
//       steps: [
//         createTable({
//           name: 'comments',
//           columns: [
//             { name: 'post_id', type: 'string', isIndexed: true },
//             { name: 'body', type: 'string' },
//           ],
//         }),
//         addColumns({
//           table: 'posts',
//           columns: [
//             { name: 'subtitle', type: 'string', isOptional: true },
//             { name: 'is_pinned', type: 'boolean' },
//           ],
//         }),
//       ],
//     },
//     {
//       version: 2,
//       steps: [
//         // ...
//       ],
//     },
//   ],
// })

export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations {
  if (isDevelopment) {
    // validate migrations spec object
    const { migrations } = migrationSpec
    invariant(Array.isArray(migrations), 'Missing migrations array')

    // validate migrations format
    migrations.forEach(migration => {
      invariant(isObject(migration), `Invalid migration (not an object) in schema migrations`)
      const { version, steps } = migration
      invariant(typeof version === 'number', 'Invalid migration - `version` must be a number')
      invariant(
        version >= 2,
        `Invalid migration to version ${version}. Minimum possible migration version is 2`,
      )
      invariant(
        Array.isArray(steps) && steps.every(step => typeof step.type === 'string'),
        `Invalid migration steps for migration to version ${version}. 'steps' should be an array of migration step calls`,
      )
    })

    // validate that migration spec is reverse-chronological and without gaps
    let maxCoveredVersion: ?number = null

    migrations.forEach(migration => {
      const { version } = migration
      if (maxCoveredVersion) {
        invariant(
          version === maxCoveredVersion - 1,
          `Invalid migrations! Migration ${JSON.stringify(
            migration,
          )} is to version ${version}, but previously listed migration is to version ${maxCoveredVersion}. Remember that migrations must be listed in reverse chronological order and without gaps -- migration to newest version must be at the top, and every following migration must be to version 1 number smaller`,
        )
      }
      maxCoveredVersion = version
    })
  }
  return {
    ...migrationSpec,
    validated: true,
  }
}

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep {
  const { name, columns } = tableSchema(tableSchemaSpec)
  return { type: 'create_table', name, columns }
}

export function addColumns({
  table,
  columns,
}: $Exact<{ table: TableName<any>, columns: ColumnSchema[] }>): AddColumnsMigrationStep {
  if (isDevelopment) {
    invariant(table, `Missing table name in addColumn()`)
    invariant(columns && Array.isArray(columns), `Missing 'columns' or not an array in addColumn()`)
    columns.forEach(column => validateColumnSchema(column))
  }

  return { type: 'add_columns', table, columns }
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
