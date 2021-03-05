// @flow

import sortBy from '../../utils/fp/sortBy'
import type { $RE } from '../../types'
import type { ColumnSchema, TableName, TableSchema, TableSchemaSpec, SchemaVersion } from '../index'
import { tableSchema, validateColumnSchema } from '../index'

import { invariant } from '../../utils/common'
import { isObj } from '../../utils/fp'

export type CreateTableMigrationStep = $RE<{
  type: 'create_table',
  schema: TableSchema,
}>

export type AddColumnsMigrationStep = $RE<{
  type: 'add_columns',
  table: TableName<any>,
  columns: ColumnSchema[],
  unsafeSql?: string => string,
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

// Creates a specification of how to migrate between different versions of
// database schema. Every time you change the database schema, you must
// create a corresponding migration.
//
// See docs for more details
//
// Example:
//
// schemaMigrations({
//   migrations: [
//     {
//       toVersion: 3,
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
//       toVersion: 2,
//       steps: [
//         // ...
//       ],
//     },
//   ],
// })

export function schemaMigrations(migrationSpec: SchemaMigrationsSpec): SchemaMigrations {
  const { migrations } = migrationSpec

  if (process.env.NODE_ENV !== 'production') {
    // validate migrations spec object
    invariant(Array.isArray(migrations), 'Missing migrations array')

    // validate migrations format
    migrations.forEach(migration => {
      invariant(isObj(migration), `Invalid migration (not an object) in schema migrations`)
      const { toVersion, steps } = migration
      invariant(typeof toVersion === 'number', 'Invalid migration - `toVersion` must be a number')
      invariant(
        toVersion >= 2,
        `Invalid migration to version ${toVersion}. Minimum possible migration version is 2`,
      )
      invariant(
        Array.isArray(steps) && steps.every(step => typeof step.type === 'string'),
        `Invalid migration steps for migration to version ${toVersion}. 'steps' should be an array of migration step calls`,
      )
    })
  }

  const sortedMigrations = sortBy(migration => migration.toVersion, migrations)
  const oldestMigration = sortedMigrations[0]
  const newestMigration = sortedMigrations[sortedMigrations.length - 1]
  const minVersion = oldestMigration ? oldestMigration.toVersion - 1 : 1
  const maxVersion = newestMigration?.toVersion || 1

  if (process.env.NODE_ENV !== 'production') {
    // validate that migration spec is without gaps and duplicates
    sortedMigrations.reduce((maxCoveredVersion, migration) => {
      const { toVersion } = migration
      if (maxCoveredVersion) {
        invariant(
          toVersion === maxCoveredVersion + 1,
          `Invalid migrations! Migrations listed cover range from version ${minVersion} to ${maxCoveredVersion}, but migration ${JSON.stringify(
            migration,
          )} is to version ${toVersion}. Migrations must be listed without gaps, or duplicates.`,
        )
      }
      return toVersion
    }, null)
  }

  return {
    sortedMigrations,
    minVersion,
    maxVersion,
    validated: true,
  }
}

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep {
  const schema = tableSchema(tableSchemaSpec)
  return { type: 'create_table', schema }
}

export function addColumns({
  table,
  columns,
  unsafeSql,
}: $Exact<{
  table: TableName<any>,
  columns: ColumnSchema[],
  unsafeSql?: string => string,
}>): AddColumnsMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in addColumn()`)
    invariant(columns && Array.isArray(columns), `Missing 'columns' or not an array in addColumn()`)
    columns.forEach(column => validateColumnSchema(column))
  }

  return { type: 'add_columns', table, columns, unsafeSql }
}

export function unsafeExecuteSql(sql: string): SqlMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(typeof sql === 'string', `SQL passed to unsafeExecuteSql is not a string`)
  }
  return { type: 'sql', sql }
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
