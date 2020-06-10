// @flow

import { uniq, groupBy, toPairs, piped } from 'rambdax'
import type { MigrationStep, CreateTableMigrationStep, AddColumnsMigrationStep } from '../index'
import type { TableName, ColumnName } from '../../index'
import { tableName } from '../../index'

import { invariant } from '../../../utils/common'
import { unnest } from '../../../utils/fp'

export type MigrationSyncChanges = $Exact<{
  +tables: TableName<any>[],
  +columns: $Exact<{
    table: TableName<any>,
    columns: ColumnName[],
  }>[],
}>

// TODO: if we have more than these two step types, it's safer if we take SchemaMigrations and from/to
// to ensure we process steps in order
export default function getSyncChanges(steps: MigrationStep[]): MigrationSyncChanges {
  steps.forEach(step => {
    invariant(
      ['create_table', 'add_columns'].includes(step.type),
      `Unknown migration step type ${step.type}. Can not perform migration sync. This most likely means your migrations are defined incorrectly. It could also be a WatermelonDB bug.`,
    )
  })

  // $FlowFixMe
  const createTableSteps: CreateTableMigrationStep[] = steps.filter(
    step => step.type === 'create_table',
  )
  const createdTables = createTableSteps.map(step => step.schema.name)

  // $FlowFixMe
  const addColumnSteps: AddColumnsMigrationStep[] = steps.filter(
    step => step.type === 'add_columns',
  )
  const allAddedColumns = addColumnSteps
    .filter(step => !createdTables.includes(step.table))
    .map(({ table, columns }) => columns.map(({ name }) => ({ table, name })))

  const columnsByTable = piped(allAddedColumns, unnest, groupBy(({ table }) => table), toPairs)
  const addedColumns = columnsByTable.map(([table, columnDefs]) => ({
    table: tableName(table),
    columns: uniq(columnDefs.map(({ name }) => name)),
  }))

  return {
    tables: uniq(createdTables),
    columns: addedColumns,
  }
}
