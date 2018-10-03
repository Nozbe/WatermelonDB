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
  )})`

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .filter(column => column.isIndexed)
    .map(column => encodeIndex(column, tableName))
    .concat([`create index ${tableName}__status on ${encodeName(tableName)} ("_status")`])
    .join(';')

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table)

export const encodeSchema: AppSchema => SQL = ({ tables }) =>
  values(tables)
    .map(encodeTable)
    .concat([''])
    .join(';')

//     +// TODO: Default values, indexes
// +const encodeCreateColumn: (ColumnSchema, TableName<any>) => SQL = (column, tableName) =>
// +  `alter table ${encodeName(tableName)} add ${encodeName(column.name)}`

export const encodeMigrationSteps: (MigrationStep[]) => SQL = steps => ''
