import {sortBy, prop, last, head} from 'rambdax';
import type { $RE } from '../../types'
import type {
  FTS5TableSchema,
  FTS5TableSchemaSpec,
  ColumnSchema,
  TableName,
  TableSchema,
  TableSchemaSpec,
  SchemaVersion,
} from '../index'
import { tableSchema, validateColumnSchema , fts5TableSchema } from '../index'

import { invariant } from '../../utils/common'
import { isObject } from '../../utils/fp'


export type CreateTableMigrationStep = $RE<{
  type: 'create_table';
  schema: TableSchema;
}>;

export type CreateFTS5TableMigrationStep = $RE<{
  type: 'create_fts5_table';
  schema: FTS5TableSchema;
}>;

export type AddColumnsMigrationStep = $RE<{
  type: 'add_columns';
  table: TableName<any>;
  columns: ColumnSchema[];
  unsafeSql?: (arg1: string) => string;
}>;

export type DropTableMigrationStep = $RE<{
  type: 'drop_table';
  table: TableName<any>;
  unsafeSql?: (arg1: string) => string;
}>;

export type DropColumnsMigrationStep = $RE<{
  type: 'drop_columns';
  table: TableName<any>;
  columns: string[];
  unsafeSql?: (arg1: string) => string;
}>;

export type AddIndexMigrationStep = $RE<{
  type: 'add_index';
  table: TableName<any>;
  column: string;
  unsafeSql?: (arg1: string) => string;
}>;

export type RemoveIndexMigrationStep = $RE<{
  type: 'remove_index';
  table: TableName<any>;
  column: string;
  unsafeSql?: (arg1: string) => string;
}>;

export type DropFTS5TableMigrationStep = $RE<{
  type: 'drop_fts5_table';
  name: string;
}>;

export type SqlMigrationStep = $RE<{
  type: 'sql';
  sql: string;
}>;

export type MigrationStep = CreateTableMigrationStep | CreateFTS5TableMigrationStep | AddColumnsMigrationStep | DropTableMigrationStep | DropColumnsMigrationStep | AddIndexMigrationStep | RemoveIndexMigrationStep | DropFTS5TableMigrationStep | SqlMigrationStep;

type Migration = $RE<{
  toVersion: SchemaVersion;
  steps: MigrationStep[];
}>;

type SchemaMigrationsSpec = $RE<{
  migrations: Migration[];
}>;

export type SchemaMigrations = $RE<{
  validated: true;
  minVersion: SchemaVersion;
  maxVersion: SchemaVersion;
  sortedMigrations: Migration[];
}>;

const sortMigrations = sortBy(prop('toVersion'))

// Creates a specification of how to migrate between different versions of
// database schema. Every time you change the database schema, you must
// create a corresponding migration.
// See docs for more details
// Example:
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
      invariant(isObject(migration), `Invalid migration (not an object) in schema migrations`)
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

  const sortedMigrations = sortMigrations(migrations)
  const oldestMigration = head(sortedMigrations)
  const newestMigration = last(sortedMigrations)
  const minVersion = oldestMigration ? oldestMigration.toVersion - 1 : 1
  const maxVersion = newestMigration?.toVersion || 1

  if (process.env.NODE_ENV !== 'production') {
    // validate that migration spec is without gaps and duplicates
    // @ts-ignore
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

export function createFTS5Table(fts5SchemaSpec: FTS5TableSchemaSpec): CreateFTS5TableMigrationStep {
  const schema = fts5TableSchema(fts5SchemaSpec)
  return { type: 'create_fts5_table', schema }
}

export function createTable(tableSchemaSpec: TableSchemaSpec): CreateTableMigrationStep {
  const schema = tableSchema(tableSchemaSpec)
  return { type: 'create_table', schema }
}

export function dropFTS5Table(name: string): DropFTS5TableMigrationStep {
  return { type: 'drop_fts5_table', name }
}

export function addColumns(
  {
    table,
    columns,
    unsafeSql,
  }: {
    table: TableName<any>;
    columns: ColumnSchema[];
    unsafeSql?: (arg1: string) => string;
  },
): AddColumnsMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in addColumn()`)
    invariant(columns && Array.isArray(columns), `Missing 'columns' or not an array in addColumn()`)
    columns.forEach(column => validateColumnSchema(column))
  }

  return { type: 'add_columns', table, columns, unsafeSql }
}

export function dropTable(
  {
    table,
    unsafeSql,
  }: {
    table: TableName<any>;
    unsafeSql?: (arg1: string) => string;
  },
): DropTableMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in dropTable()`)
  }

  return { type: 'drop_table', table, unsafeSql }
}

export function dropColumns(
  {
    table,
    columns,
    unsafeSql,
  }: {
    table: TableName<any>;
    columns: string[];
    unsafeSql?: (arg1: string) => string;
  },
): DropColumnsMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in dropColumns()`)
    invariant(
      columns && Array.isArray(columns),
      `Missing 'columns' or not an array in dropColumns()`,
    )
    columns.forEach(column => {
      invariant(typeof column === 'string', `Column name must be a string in dropColumns()`)
    })
  }

  return { type: 'drop_columns', table, columns, unsafeSql }
}

export function addIndex(
  {
    table,
    column,
    unsafeSql,
  }: {
    table: TableName<any>;
    column: string;
    unsafeSql?: (arg1: string) => string;
  },
): AddIndexMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in addIndex()`)
    invariant(typeof column === 'string', `Column name must be a string in addIndex()`)
  }

  return { type: 'add_index', table, column, unsafeSql }
}

export function removeIndex(
  {
    table,
    column,
    unsafeSql,
  }: {
    table: TableName<any>;
    column: string;
    unsafeSql?: (arg1: string) => string;
  },
): RemoveIndexMigrationStep {
  if (process.env.NODE_ENV !== 'production') {
    invariant(table, `Missing table name in removeIndex()`)
    invariant(typeof column === 'string', `Column name must be a string in removeIndex()`)
  }

  return { type: 'remove_index', table, column, unsafeSql }
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
