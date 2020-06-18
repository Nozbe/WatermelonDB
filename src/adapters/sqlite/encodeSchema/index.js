// @flow

import type { TableSchema, AppSchema, ColumnSchema, TableName } from '../../../Schema'
import { nullValue } from '../../../RawRecord'
import type {
  MigrationStep,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
} from '../../../Schema/migrations'
import type { SQL } from '../index'
import { logger } from '../../../utils/common'

import encodeName from '../encodeName'
import encodeValue from '../encodeValue'

const standardColumns = `"id" primary key, "_changed", "_status"`

const encodeCreateTable: (TableSchema) => SQL = ({ name, columns }) => {
  const columnsSQL = [standardColumns]
    .concat(Object.keys(columns).map((column) => encodeName(column)))
    .join(', ')
  return `create table ${encodeName(name)} (${columnsSQL});`
}

const encodeIndex: (ColumnSchema, TableName<any>) => SQL = (column, tableName) =>
  column.isIndexed
    ? `create index "${tableName}_${column.name}" on ${encodeName(tableName)} (${encodeName(
        column.name,
      )});`
    : ''

const encodeTableIndicies: (TableSchema) => SQL = ({ name: tableName, columns }) =>
  Object.values(columns)
    // $FlowFixMe
    .map((column) => encodeIndex(column, tableName))
    .concat([`create index "${tableName}__status" on ${encodeName(tableName)} ("_status");`])
    .join('')

const transform = (sql: string, transformer: ?(string) => string) =>
  transformer ? transformer(sql) : sql

const encodeTable: (TableSchema) => SQL = (table) =>
  transform(encodeCreateTable(table) + encodeTableIndicies(table), table.unsafeSql)
const encodeFTSTrigger: ({
  tableName: string,
  ftsTableName: string,
  event: 'delete' | 'insert' | 'update',
  action: SQL,
}) => SQL = ({ tableName, ftsTableName, event, action }) => {
  const triggerName = `${ftsTableName}_${event}`
  return `create trigger ${encodeName(triggerName)} after ${event} on ${encodeName(
    tableName,
  )} begin ${action} end;`
}

const encodeFTSDeleteTrigger: ({
  tableName: string,
  ftsTableName: string,
}) => SQL = ({ tableName, ftsTableName }) =>
  encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'delete',
    action: `delete from ${encodeName(ftsTableName)} where "rowid" = OLD.rowid;`,
  })

const encodeFTSInsertTrigger: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({ tableName, ftsTableName, ftsColumns }) => {
  const rawColumnNames = ['rowid', ...ftsColumns.map(column => column.name)]
  const columns = rawColumnNames.map(encodeName)
  const valueColumns = rawColumnNames.map(column => `NEW.${encodeName(column)}`)

  const columnsSQL = columns.join(', ')
  const valueColumnsSQL = valueColumns.join(', ')

  return encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'insert',
    action: `insert into ${encodeName(ftsTableName)} (${columnsSQL}) values (${valueColumnsSQL});`,
  })
}

const encodeFTSUpdateTrigger: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({ tableName, ftsTableName, ftsColumns }) => {
  const rawColumnNames = ftsColumns.map(column => column.name)
  const assignments = rawColumnNames.map(
    column => `${encodeName(column)} = NEW.${encodeName(column)}`,
  )

  const assignmentsSQL = assignments.join(', ')

  return encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'update',
    action: `update ${encodeName(ftsTableName)} set ${assignmentsSQL} where "rowid" = NEW."rowid";`,
  })
}

const encodeFTSTriggers: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({ tableName, ftsTableName, ftsColumns }) => {
  return (
    encodeFTSDeleteTrigger({ tableName, ftsTableName }) +
    encodeFTSInsertTrigger({ tableName, ftsTableName, ftsColumns }) +
    encodeFTSUpdateTrigger({ tableName, ftsTableName, ftsColumns })
  )
}

const encodeFTSTable: ({
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({ ftsTableName, ftsColumns }) => {
  const columnsSQL = ftsColumns.map(column => encodeName(column.name)).join(', ')
  return `create virtual table ${encodeName(ftsTableName)} using fts4(${columnsSQL});`
}

const encodeFTSSearch: TableSchema => SQL = ({ name: tableName, columns }) => {
  const ftsColumns = values(columns).filter(c => c.isSearchable)
  if (ftsColumns.length === 0) {
    return ''
  }
  const ftsTableName = `${tableName}_fts`
  return (
    encodeFTSTable({ ftsTableName, ftsColumns }) +
    encodeFTSTriggers({ tableName, ftsTableName, ftsColumns })
  )
}

const encodeTable: TableSchema => SQL = table =>
  encodeCreateTable(table) + encodeTableIndicies(table) + encodeFTSSearch(table)

export const encodeSchema: (AppSchema) => SQL = ({ tables, unsafeSql }) => {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(encodeTable)
    .join('')
  return transform(sql, unsafeSql)
}

const encodeCreateTableMigrationStep: (CreateTableMigrationStep) => SQL = ({ schema }) =>
  encodeTable(schema)

const encodeAddColumnsMigrationStep: (AddColumnsMigrationStep) => SQL = ({
  table,
  columns,
  unsafeSql,
}) =>
  columns
    .map((column) => {
      const addColumn = `alter table ${encodeName(table)} add ${encodeName(column.name)};`
      const setDefaultValue = `update ${encodeName(table)} set ${encodeName(
        column.name,
      )} = ${encodeValue(nullValue(column))};`
      const addIndex = encodeIndex(column, table)

      if (column.isSearchable) {
        logger.warn(
          '[DB][Worker] Support for migrations and isSearchable is still to be implemented',
        )
      }

      return transform(addColumn + setDefaultValue + addIndex, unsafeSql)
    })
    .join('')

export const encodeMigrationSteps: (MigrationStep[]) => SQL = (steps) =>
  steps
    .map((step) => {
      if (step.type === 'create_table') {
        return encodeCreateTableMigrationStep(step)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      } else if (step.type === 'sql') {
        return step.sql
      }

      throw new Error(`Unsupported migration step ${step.type}`)
    })
    .join('')
