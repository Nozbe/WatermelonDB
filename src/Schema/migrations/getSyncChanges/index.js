// @flow

import { unique, groupBy, toPairs, pipe, unnest } from '../../../utils/fp'
import type { CreateTableMigrationStep, AddColumnsMigrationStep, SchemaMigrations } from '../index'
import type { TableName, ColumnName, SchemaVersion } from '../../index'
import { tableName } from '../../index'
import { stepsForMigration } from '../stepsForMigration'

import { invariant } from '../../../utils/common'

export type MigrationSyncChanges = $Exact<{
  +from: SchemaVersion,
  +tables: TableName<any>[],
  +columns: $Exact<{
    table: TableName<any>,
    columns: ColumnName[],
  }>[],
  +renamedColumns: $Exact<{
    table: TableName<any>,
    columns: $Exact<{
      from: ColumnName,
      to: ColumnName,
    }>[],
  }>[],
}> | null

export default function getSyncChanges(
  migrations: SchemaMigrations,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
): MigrationSyncChanges {
  const steps = stepsForMigration({ migrations, fromVersion, toVersion })
  invariant(steps, 'Necessary range of migrations for sync is not available')
  invariant(
    toVersion === migrations.maxVersion,
    'getSyncChanges toVersion should be equal to maxVersion of migrations',
  )
  if (fromVersion === toVersion) {
    return null
  }

  steps.forEach((step) => {
    invariant(
      [
        'create_table',
        'add_columns',
        'destroy_column',
        'rename_column',
        'destroy_table',
        'sql',
      ].includes(step.type),
      `Unknown migration step type ${step.type}. Can not perform migration sync. This most likely means your migrations are defined incorrectly. It could also be a WatermelonDB bug.`,
    )
  })

  // $FlowFixMe
  const createTableSteps: CreateTableMigrationStep[] = steps.filter(
    (step) => step.type === 'create_table',
  )
  const createdTables = createTableSteps.map((step) => step.schema.name)

  // $FlowFixMe
  const addColumnSteps: AddColumnsMigrationStep[] = steps.filter(
    (step) => step.type === 'add_columns',
  )
  const allAddedColumns = addColumnSteps
    .filter((step) => !createdTables.includes(step.table))
    .map(({ table, columns }) => columns.map(({ name }) => ({ table, name })))

  const columnsByTable = pipe(
    unnest,
    groupBy(({ table }) => table),
    toPairs,
  )(allAddedColumns)
  const addedColumns = columnsByTable.map(([table, columnDefs]) => ({
    table: tableName(table),
    columns: unique(columnDefs.map(({ name }) => name)),
  }))

  const allRenamedColumns = steps.filter(
    (step) => step.type === 'rename_column' && !createdTables.includes(step.table),
  )

  const renamedColumns = pipe(
    groupBy(({ table }) => table),
    toPairs,
  )(allRenamedColumns).map(([table, columns]) => ({
    table: tableName(table),
    columns: columns.map(({ from, to }) => ({ from, to })),
  }))

  return {
    from: fromVersion,
    tables: unique(createdTables),
    columns: addedColumns,
    renamedColumns,
  }
}
