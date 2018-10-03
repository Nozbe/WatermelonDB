// @flow

import { keys, values } from 'rambdax'
import type { TableSchema, AppSchema, ColumnSchema, TableName } from '../../../Schema'
import type {
  MigrationStep,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
} from '../../../Schema/migrations'
import type { SQL } from '../index'

import encodeName from '../encodeName'

const standardColumns = `"id" primary key, "_changed", "_status", "last_modified"`

const encodeCreateTable: TableSchema => SQL = ({ name, columns }) => {
  const columnsSQL = [standardColumns]
    .concat(keys(columns).map(column => encodeName(column)))
    .join(', ')
  return `create table ${encodeName(name)} (${columnsSQL});`
}

const encodeIndex: (ColumnSchema, TableName<any>) => SQL = (column, tableName) =>
  `create index ${tableName}_${column.name} on ${encodeName(tableName)} (${encodeName(
    column.name,
  )});`

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .filter(column => column.isIndexed)
    .map(column => encodeIndex(column, tableName))
    .concat([`create index ${tableName}__status on ${encodeName(tableName)} ("_status");`])
    .join('')

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table)

export const encodeSchema: AppSchema => SQL = ({ tables }) =>
  values(tables)
    .map(encodeTable)
    .join('')

const encodeCreateTableMigrationStep: CreateTableMigrationStep => SQL = ({ name, columns }) =>
  encodeTable({ name, columns })

const encodeAddColumnsMigrationStep: AddColumnsMigrationStep => SQL = ({ table, columns }) =>
  columns
    .map(
      column =>
        `alter table ${encodeName(table)} add ${encodeName(column.name)};${
          column.isIndexed ? encodeIndex(column, table) : ''
        }`,
    )
    .join('')

export const encodeMigrationSteps: (MigrationStep[]) => SQL = steps =>
  steps
    .map(step => {
      if (step.type === 'create_table') {
        return encodeCreateTableMigrationStep(step)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      }

      return ''
    })
    .join('')
