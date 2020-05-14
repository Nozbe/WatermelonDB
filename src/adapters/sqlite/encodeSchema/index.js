// @flow

import { keys, values } from 'rambdax'
import type { TableSchema, AppSchema, ColumnSchema, TableName } from '../../../Schema'
import { nullValue } from '../../../RawRecord'
import type {
  MigrationStep,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
} from '../../../Schema/migrations'
import type { SQL } from '../index'

import encodeName from '../encodeName'
import encodeValue from '../encodeValue'

const standardColumns = `"id" primary key, "_changed", "_status"`

const encodeCreateTable: TableSchema => SQL = ({ name, columns }) => {
  const columnsSQL = [standardColumns]
    .concat(keys(columns).map(column => encodeName(column)))
    .join(', ')
  return `create table ${encodeName(name)} (${columnsSQL});`
}

const encodeIndex: (ColumnSchema, TableName<any>) => SQL = (column, tableName) =>
  column.isIndexed
    ? `create index ${tableName}_${column.name} on ${encodeName(tableName)} (${encodeName(
        column.name,
      )});`
    : ''

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .map(column => encodeIndex(column, tableName))
    .concat([`create index ${tableName}__status on ${encodeName(tableName)} ("_status");`])
    .join('')

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table)

export const encodeSchema: AppSchema => SQL = ({ tables }) =>
  values(tables)
    .map(encodeTable)
    .join('')

const encodeCreateTableMigrationStep: CreateTableMigrationStep => SQL = ({ schema }) =>
  encodeTable(schema)

const encodeAddColumnsMigrationStep: AddColumnsMigrationStep => SQL = ({ table, columns }) =>
  columns
    .map(column => {
      const addColumn = `alter table ${encodeName(table)} add ${encodeName(column.name)};`
      const setDefaultValue = `update ${encodeName(table)} set ${encodeName(
        column.name,
      )} = ${encodeValue(nullValue(column))};`
      const addIndex = encodeIndex(column, table)

      return addColumn + setDefaultValue + addIndex
    })
    .join('')

export const encodeMigrationSteps: (MigrationStep[]) => SQL = steps =>
  steps
    .map(step => {
      if (step.type === 'create_table') {
        return encodeCreateTableMigrationStep(step)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      }

      throw new Error(`Unsupported migration step ${step.type}`)
    })
    .join('')
