// @flow

import { keys, values } from 'rambdax'
import type {
  FTS5TableSchema,
  TableSchema,
  AppSchema,
  ColumnSchema,
  TableName,
} from '../../../Schema'
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

const encodeCreateFTS5Table: FTS5TableSchema => SQL = ({ name, columns, contentTable }) => {
  const columnsSQL = columns.map(column => encodeName(column)).join(', ')

  return `
    create virtual table ${encodeName(
      name,
    )} using fts5(id, ${columnsSQL}, content='', prefix ='2 3 4');
    insert or replace into ${name} (rowid, id, ${columnsSQL}) select rowid, id, ${columnsSQL} from ${contentTable};
  `
}

const encodeFTS5SyncProcedures = ({ name, columns, contentTable }) => {
  const columnsSQL = columns.map(column => encodeName(column)).join(', ')

  const newColumnsSQL = columns.map(column => `new.${encodeName(column)}`).join(', ')

  return `
    create trigger ${encodeName(`${name}_ai`)} after insert on ${encodeName(contentTable)} begin
      insert into ${encodeName(
        name,
      )} (rowid, id, ${columnsSQL}) values (new.rowid, new.id, ${newColumnsSQL});
    end;

    create trigger ${encodeName(`${name}_ad`)} after delete on ${encodeName(contentTable)} begin
      delete from ${encodeName(name)} where id = old.id;
    end;

    create trigger ${encodeName(`${name}_au`)} after update on ${encodeName(contentTable)} begin
      insert into ${encodeName(
        name,
      )} (rowid, id, ${columnsSQL}) values (new.rowid, new.id, ${newColumnsSQL});
    end;
  `
}

const encodeDropFTS5Table: FTS5TableSchema => SQL = ({ name }) =>
  `drop table if exists ${encodeName(name)};`

const encodeDropFTS5SyncProcedures = ({ name }) => {
  return `
    drop trigger if exists ${encodeName(`${name}_ai`)};
    drop trigger if exists ${encodeName(`${name}_ad`)};
    drop trigger if exists ${encodeName(`${name}_au`)};
  `
}

const encodeFTS5Table: FTS5TableSchema => SQL = tableSchema =>
  encodeCreateFTS5Table(tableSchema) + encodeFTS5SyncProcedures(tableSchema)

const encodeIndex: (ColumnSchema, TableName<any>) => SQL = (column, tableName) =>
  column.isIndexed
    ? `create index "${tableName}_${column.name}" on ${encodeName(tableName)} (${encodeName(
        column.name,
      )});`
    : ''

const encodeTableIndicies: TableSchema => SQL = ({ name: tableName, columns }) =>
  values(columns)
    .map(column => encodeIndex(column, tableName))
    .concat([`create index "${tableName}__status" on ${encodeName(tableName)} ("_status");`])
    .join('')

const transform = (sql: string, transformer: ?(string) => string) =>
  transformer ? transformer(sql) : sql

const encodeTable: TableSchema => SQL = table =>
  transform(encodeCreateTable(table) + encodeTableIndicies(table), table.unsafeSql)

export const encodeSchema: AppSchema => SQL = ({ tables, fts5Tables, unsafeSql }) => {
  const sql = values(tables)
    .map(encodeTable)
    .join('')

  const fts5Sql = values(fts5Tables)
    .map(encodeFTS5Table)
    .join('')

  return transform(sql + fts5Sql, unsafeSql)
}

const encodeDropFTS5TableMigrationStep: FTS5TableSchema => SQL = ({ name }) =>
  encodeDropFTS5Table({ name }) + encodeDropFTS5SyncProcedures({ name })

const encodeCreateFTS5TableMigrationStep: CreateFTS5TableMigrationStep => SQL = ({ schema }) =>
  encodeFTS5Table(schema)

const encodeCreateTableMigrationStep: CreateTableMigrationStep => SQL = ({ schema }) =>
  encodeTable(schema)

const encodeAddColumnsMigrationStep: AddColumnsMigrationStep => SQL = ({
  table,
  columns,
  unsafeSql,
}) =>
  columns
    .map(column => {
      const addColumn = `alter table ${encodeName(table)} add ${encodeName(column.name)};`
      const setDefaultValue = `update ${encodeName(table)} set ${encodeName(
        column.name,
      )} = ${encodeValue(nullValue(column))};`
      const addIndex = encodeIndex(column, table)

      return transform(addColumn + setDefaultValue + addIndex, unsafeSql)
    })
    .join('')

export const encodeMigrationSteps: (MigrationStep[]) => SQL = steps =>
  steps
    .map(step => {
      if (step.type === 'create_table') {
        return encodeCreateTableMigrationStep(step)
      }
      if (step.type === 'create_fts5_table') {
        return encodeCreateFTS5TableMigrationStep(step)
      } else if (step.type === 'add_columns') {
        return encodeAddColumnsMigrationStep(step)
      } else if (step.type === 'sql') {
        return step.sql
      } else if (step.type === 'drop_fts5_table') {
        return encodeDropFTS5TableMigrationStep(step)
      }

      throw new Error(`Unsupported migration step ${step.type}`)
    })
    .join('')
