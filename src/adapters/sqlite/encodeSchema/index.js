// @flow

import { keys, values } from 'rambdax'
import type { TableSchema, AppSchema } from 'Schema'
import type { SQL } from '../index'

const standardColumns = `_changed, _status, id primary key, last_modified`

const encodeCreateTable: TableSchema => SQL = ({ name, columns }) => {
  const columnsSQL = [standardColumns].concat(keys(columns)).join(', ')
  return `create table ${name} (${columnsSQL});`
}

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .filter(column => column.isIndexed)
    .map(column => `create index ${tableName}_${column.name} on ${tableName} (${column.name})`)
    .concat([`create index ${tableName}__status on ${tableName} (_status)`])
    .join(';')

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table)

const encodeSchema: AppSchema => SQL = ({ tables }) =>
  values(tables)
    .map(encodeTable)
    .concat([''])
    .join(';')

export default encodeSchema
