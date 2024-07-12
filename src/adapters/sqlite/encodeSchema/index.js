// @flow

import type { TableSchema, AppSchema, ColumnSchema, TableName } from '../../../Schema'
import { nullValue } from '../../../RawRecord'
import type {
  MigrationStep,
  AddColumnsMigrationStep,
  DestroyColumnMigrationStep,
  RenameColumnMigrationStep,
  DestroyTableMigrationStep,
} from '../../../Schema/migrations'
import type { SQL } from '../index'

import encodeValue from '../encodeValue'

const standardColumnsInsertSQL = `"id" primary key, "_changed", "_status"`
const commonSchema =
  'create table "local_storage" ("key" varchar(16) primary key not null, "value" text not null);' +
  'create index "local_storage_key_index" on "local_storage" ("key");'

const encodeCreateTable = ({ name, columns }: TableSchema): SQL => {
  const columnsSQL = [standardColumnsInsertSQL]
    .concat(Object.keys(columns).map((column) => `"${column}"`))
    .join(', ')
  return `create table "${name}" (${columnsSQL});`
}

const encodeIndex = (column: ColumnSchema, tableName: TableName<any>): SQL =>
  column.isIndexed
    ? `create index if not exists "${tableName}_${column.name}" on "${tableName}" ("${column.name}");`
    : ''

const encodeTableIndicies = ({ name: tableName, columns }: TableSchema): SQL =>
  Object.values(columns)
    // $FlowFixMe
    .map((column) => encodeIndex(column, tableName))
    .concat([`create index if not exists "${tableName}__status" on "${tableName}" ("_status");`])
    .join('')

const identity = (sql: SQL, _?: any): SQL => sql

const encodeTable = (table: TableSchema): SQL =>
  (table.unsafeSql || identity)(encodeCreateTable(table) + encodeTableIndicies(table))

export const encodeSchema = ({ tables, unsafeSql }: AppSchema): SQL => {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(encodeTable)
    .join('')
  return (unsafeSql || identity)(commonSchema + sql, 'setup')
}

export function encodeCreateIndices({ tables, unsafeSql }: AppSchema): SQL {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(encodeTableIndicies)
    .join('')
  return (unsafeSql || identity)(sql, 'create_indices')
}

export function encodeDropIndices({ tables, unsafeSql }: AppSchema): SQL {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(({ name: tableName, columns }) =>
      Object.values(columns)
        // $FlowFixMe
        .map((column) =>
          column.isIndexed ? `drop index if exists "${tableName}_${column.name}";` : '',
        )
        .concat([`drop index if exists "${tableName}__status";`])
        .join(''),
    )
    .join('')
  return (unsafeSql || identity)(sql, 'drop_indices')
}

const encodeAddColumnsMigrationStep: (AddColumnsMigrationStep) => SQL = ({
  table,
  columns,
  unsafeSql,
}) =>
  columns
    .map((column) => {
      const addColumn = `alter table "${table}" add "${column.name}";`
      const setDefaultValue = `update "${table}" set "${column.name}" = ${encodeValue(
        nullValue(column),
      )};`
      const addIndex = encodeIndex(column, table)

      return (unsafeSql || identity)(addColumn + setDefaultValue + addIndex)
    })
    .join('')

// Requires sqlite 3.35.0 / iOS 15 / Android 14
const encodeDestroyColumnMigrationStep: (DestroyColumnMigrationStep) => SQL = ({
  table,
  column,
  unsafeSql,
}) => {
  // We don't know if column is indexed, but if it is, we need to drop it
  return (unsafeSql || identity)(
    `drop index if exists "${table}_${column}";alter table "${table}" drop column "${column}";`,
  )
}

// Requires sqlite 3.25.0 / iOS 13 / Android 11
const encodeRenameColumnMigrationStep: (RenameColumnMigrationStep) => SQL = ({
  table,
  from,
  to,
  unsafeSql,
}) => {
  return (unsafeSql || identity)(`alter table "${table}" rename column "${from}" to "${to}";`)
}

const encodeDestroyTableMigrationStep: (DestroyTableMigrationStep) => SQL = ({
  table,
  unsafeSql,
}) => {
  return (unsafeSql || identity)(`drop table if exists "${table}";`)
}

export const encodeMigrationSteps: (MigrationStep[]) => SQL = (steps) =>
  steps
    .map((step) => {
      if (step.type === 'create_table') {
        return encodeTable(step.schema)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      } else if (step.type === 'destroy_column') {
        return encodeDestroyColumnMigrationStep(step)
      } else if (step.type === 'rename_column') {
        return encodeRenameColumnMigrationStep(step)
      } else if (step.type === 'destroy_table') {
        return encodeDestroyTableMigrationStep(step)
      } else if (step.type === 'sql') {
        return step.sql
      }

      throw new Error(`Unsupported migration step ${step.type}`)
    })
    .join('')
