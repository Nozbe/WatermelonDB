// @flow

import { keys, values } from 'rambdax'
import type { TableSchema, AppSchema } from 'Schema'
import type { SQL } from '../index'

import encodeName from '../encodeName'

const standardColumns = `"id" primary key, "_changed", "_status", "last_modified"`

const encodeCreateTable: TableSchema => SQL = ({ name, columns }) => {
  const columnsSQL = [standardColumns]
    .concat(keys(columns).map(column => encodeName(column)))
    .join(', ')
  return `create table ${encodeName(name)} (${columnsSQL});`
}

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .filter(column => column.isIndexed)
    .map(
      column =>
        `create index ${tableName}_${column.name} on ${encodeName(tableName)} (${encodeName(
          column.name,
        )})`,
    )
    .concat([`create index ${tableName}__status on ${encodeName(tableName)} ("_status")`])
    .join(';')

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table)

const encodeSchema: AppSchema => SQL = ({ tables }) =>
  values(tables)
    .map(encodeTable)
    .concat([''])
    .join(';')

export default encodeSchema
