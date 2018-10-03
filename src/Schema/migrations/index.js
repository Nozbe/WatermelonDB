// @flow

import type { ColumnSchema, TableName, ColumnMap, TableSchemaSpec, SchemaVersion } from '../index'
import { tableSchema, validateColumnSchema } from '../index'

import { isDevelopment, invariant } from '../../utils/common'
import { isObject } from '../../utils/fp'

type CreateTableMigrationStep = $Exact<{
  +type: 'create_table',
  +name: TableName<any>,
  +columns: ColumnMap,
}>

type AddColumnsMigrationStep = $Exact<{
  +type: 'add_columns',
  +table: TableName<any>,
  +columns: ColumnSchema[],
}>

export type MigrationStep = CreateTableMigrationStep | AddColumnsMigrationStep

type Migration = $Exact<{
  +from: SchemaVersion,
  +to: SchemaVersion,
  +steps: MigrationStep[],
}>

type SchemaMigrationsSpec = $Exact<{
  +minimumVersion: SchemaVersion,
  +currentVersion: SchemaVersion,
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
// Note that migrations must cover the whole range from `minimumVersion` to `currentVersion`
// and be listed in reverse chronological order (migration to newest version at the top)
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
//             { name: 'is_pinned', type: 'bool' },
//           ],
//         }),
//       ],
//     },
//     {
//       from: 1,
//       to: 2,
//       steps: [
//         // ...
//       ],
//     },
//   ],
// })

export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations {
  if (isDevelopment) {
    // validate migrations spec object
    const { minimumVersion, currentVersion, migrations } = migrationSpec
    invariant(typeof minimumVersion === 'number', 'Minimum schema version missing in migrations')
    invariant(typeof currentVersion === 'number', 'Current schema version missing in migrations')
    invariant(minimumVersion > 0, 'Minimum version must be at least 1')
    invariant(
      currentVersion >= minimumVersion,
      'Current schema version must be greater than minimum migrable version',
    )

    invariant(Array.isArray(migrations), 'Missing migrations array')

    // validate migrations format
    migrations.forEach(migration => {
      invariant(isObject(migration), `Invalid migration (not an object) in schema migrations`)
      const { from, to, steps } = migration
      invariant(
        typeof from === 'number' && typeof to === 'number' && to > from,
        'Invalid migration - `to` version must be greater than `from` version',
      )
      invariant(
        Array.isArray(steps) && steps.every(step => typeof step.type === 'string'),
        `Invalid migration steps for migration from version ${from} to ${to}. 'changes' should be an array of migration step calls`,
      )
    })

    // validate if migration spec actually covers every schema version it says it supports
    const chronologicalMigrations = [...migrations].reverse()
    let maxCoveredRange = minimumVersion

    chronologicalMigrations.forEach(({ from, to }) => {
      invariant(
        maxCoveredRange === from,
        `Invalid migrations! schemaMigrations() says it covers schema versions from ${minimumVersion} to ${currentVersion}, but there is no listed migration from ${maxCoveredRange} to ${from}. Remember that migrations must be listed in reverse chronological order`,
      )
      maxCoveredRange = to
    })
    invariant(
      maxCoveredRange === currentVersion,
      `Invalid migrations! schemaMigrations() says the current version is ${currentVersion}, but migrations listed only cover schema versions range from ${minimumVersion} to ${maxCoveredRange}. Remember that migrations must be listed in reverse chronological order`,
    )
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
