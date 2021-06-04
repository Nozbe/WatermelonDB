// @flow

import type { TableSchema, AppSchema, ColumnSchema, TableName } from '../../../Schema'
import { nullValue } from '../../../RawRecord'
import type { MigrationStep, AddColumnsMigrationStep } from '../../../Schema/migrations'
import type { SQL } from '../index'

import encodeValue from '../encodeValue'

const standardColumns = `"id" primary key, "_changed", "_status"`
const commonSchema =
  'create table "local_storage" ("key" varchar(16) primary key not null, "value" text not null);' +
  'create index "local_storage_key_index" on "local_storage" ("key");'

const encodeCreateTable = ({ name, columns }: TableSchema): SQL => {
  const columnsSQL = [standardColumns]
    .concat(Object.keys(columns).map((column) => `"${column}"`))
    .join(', ')
  return `create table "${name}" (${columnsSQL});`
}

const encodeIndex = (column: ColumnSchema, tableName: TableName<any>): SQL =>
  column.isIndexed
    ? `create index "${tableName}_${column.name}" on "${tableName}" ("${column.name}");`
    : ''

const encodeTableIndicies = ({ name: tableName, columns }: TableSchema): SQL =>
  Object.values(columns)
    // $FlowFixMe
    .map((column) => encodeIndex(column, tableName))
    .concat([`create index "${tableName}__status" on "${tableName}" ("_status");`])
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
        .map((column) => (column.isIndexed ? `drop index "${tableName}_${column.name}";` : ''))
        .concat([`drop index "${tableName}__status";`])
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

export const encodeMigrationSteps: (MigrationStep[]) => SQL = (steps) =>
  steps
    .map((step) => {
      if (step.type === 'create_table') {
        return encodeTable(step.schema)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      } else if (step.type === 'sql') {
        return step.sql
      }

      throw new Error(`Unsupported migration step ${step.type}`)
    })
    .join('')
