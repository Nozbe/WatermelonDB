// @flow

import type {
  TableSchema,
  AppSchema,
  ColumnSchema,
  TableName
} from '../../../Schema'
import {
  nullValue
} from '../../../RawRecord'
import type {
  MigrationStep,
  AddColumnsMigrationStep
} from '../../../Schema/migrations'
import type {
  SQL
} from '../index'
import {
  invariant
} from '../../../utils/common'

import encodeValue from '../encodeValue'

const standardColumns = `"id" primary key, "_changed", "_status"`
const commonSchema =
  'create table "local_storage" ("key" varchar(16) primary key not null, "value" text not null);' +
  'create index "local_storage_key_index" on "local_storage" ("key");'

const encodeCreateTable = ({
  name,
  columns
}: TableSchema): SQL => {
  const columnsSQL = [standardColumns]
    .concat(Object.keys(columns).map((column) => `"${column}"`))
    .join(', ')
  return `create table "${name}" (${columnsSQL});`
}

const encodeIndex = (column: ColumnSchema, tableName: TableName < any > ): SQL =>
  column.isIndexed ?
  `create index "${tableName}_${column.name}" on "${tableName}" ("${column.name}");` :
  ''

const encodeTableIndicies = ({
    name: tableName,
    columns
  }: TableSchema): SQL =>
  Object.values(columns)
  // $FlowFixMe
  .map((column) => encodeIndex(column, tableName))
  .concat([`create index "${tableName}__status" on "${tableName}" ("_status");`])
  .join('')

const identity = (sql: SQL, _ ? : any): SQL => sql

const encodeTable = (table: TableSchema): SQL =>
  (table.unsafeSql || identity)(encodeCreateTable(table) + encodeTableIndicies(table) + encodeFTSSearch(table))

/** FTS Full Text Search */

const encodeFTSTrigger: ({
  tableName: string,
  ftsTableName: string,
  event: 'delete' | 'insert' | 'update',
  action: SQL,
}) => SQL = ({
  tableName,
  ftsTableName,
  event,
  action
}) => {
  const triggerName = `${ftsTableName}_${event}`
  return `create trigger "${triggerName}" after ${event} on "${tableName}" begin ${action} end;`
}

const encodeFTSDeleteTrigger: ({
    tableName: string,
    ftsTableName: string,
  }) => SQL = ({
    tableName,
    ftsTableName
  }) =>
  encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'delete',
    action: `delete from "${ftsTableName}" where "rowid" = OLD.rowid;`,
  })

const encodeFTSInsertTrigger: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({
  tableName,
  ftsTableName,
  ftsColumns
}) => {
  const rawColumnNames = ['rowid', ...ftsColumns.map((column) => column.name)]
  const columns = rawColumnNames.map((col) => `"${col}"`)
  const valueColumns = rawColumnNames.map((column) => `NEW."${column}"`)

  const columnsSQL = columns.join(', ')
  const valueColumnsSQL = valueColumns.join(', ')

  return encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'insert',
    action: `insert into "${ftsTableName}" (${columnsSQL}) values (${valueColumnsSQL});`,
  })
}

const encodeFTSUpdateTrigger: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({
  tableName,
  ftsTableName,
  ftsColumns
}) => {
  const rawColumnNames = ftsColumns.map((column) => column.name)
  const assignments = rawColumnNames.map(
    (column) => `"${column}" = NEW."${column}"`,
  )

  const assignmentsSQL = assignments.join(', ')

  return encodeFTSTrigger({
    tableName,
    ftsTableName,
    event: 'update',
    action: `update "${ftsTableName}" set ${assignmentsSQL} where "rowid" = NEW."rowid";`,
  })
}

const encodeFTSTriggers: ({
  tableName: string,
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({
  tableName,
  ftsTableName,
  ftsColumns
}) => {
  return (
    encodeFTSDeleteTrigger({
      tableName,
      ftsTableName
    }) +
    encodeFTSInsertTrigger({
      tableName,
      ftsTableName,
      ftsColumns
    }) +
    encodeFTSUpdateTrigger({
      tableName,
      ftsTableName,
      ftsColumns
    })
  )
}

const encodeFTSTable: ({
  ftsTableName: string,
  ftsColumns: ColumnSchema[],
}) => SQL = ({
  ftsTableName,
  ftsColumns
}) => {
  const columnsSQL = ftsColumns.map((column) => `"${column.name}"`).join(', ')
  return `create virtual table "${ftsTableName}" using fts5(${columnsSQL});`
}

const encodeFTSSearch: (TableSchema) => SQL = (tableSchema) => {
  const {
    name: tableName,
    columnArray
  } = tableSchema
  const ftsColumns = columnArray.filter((column) => column.isFTS)
  if (ftsColumns.length === 0) {
    return ''
  }
  const ftsTableName = `_fts_${tableName}`
  return (
    encodeFTSTable({
      ftsTableName,
      ftsColumns
    }) +
    encodeFTSTriggers({
      tableName,
      ftsTableName,
      ftsColumns
    })
  )
}

/** FTS END */

export const encodeSchema = ({
  tables,
  unsafeSql
}: AppSchema): SQL => {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(encodeTable)
    .join('')
  return (unsafeSql || identity)(commonSchema + sql, 'setup')
}

export function encodeCreateIndices({
  tables,
  unsafeSql
}: AppSchema): SQL {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(encodeTableIndicies)
    .join('')
  return (unsafeSql || identity)(sql, 'create_indices')
}

export function encodeDropIndices({
  tables,
  unsafeSql
}: AppSchema): SQL {
  const sql = Object.values(tables)
    // $FlowFixMe
    .map(({
        name: tableName,
        columns
      }) =>
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

    invariant(
      !column.isFTS,
      '[DB][Worker] Support for migrations with isFTS is still to be implemented',
    )
    
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