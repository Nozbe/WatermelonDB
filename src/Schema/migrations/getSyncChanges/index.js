// @flow

import { unique, groupBy, toPairs, pipe } from '../../../utils/fp'
import type { SchemaMigrations } from '../index'
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
      ['create_table', 'add_columns', 'sql', 'destroy_table', 'loki'].includes(step.type),
      `Unknown migration step type ${step.type}. Can not perform migration sync. This most likely means your migrations are defined incorrectly. It could also be a WatermelonDB bug.`,
    )
  })

  // NOTE: Steps are processed in order, so that tables (and columns) destroyed later in the range
  // are not reported, while tables destroyed and then created again are
  let createdTables: TableName<any>[] = []
  let addedColumns: { table: TableName<any>, name: ColumnName }[] = []
  steps.forEach((step) => {
    if (step.type === 'create_table') {
      createdTables.push(step.schema.name)
    } else if (step.type === 'add_columns') {
      const { table, columns } = step
      columns.forEach(({ name }) => {
        addedColumns.push({ table, name })
      })
    } else if (step.type === 'destroy_table') {
      const { table } = step
      createdTables = createdTables.filter((name) => name !== table)
      addedColumns = addedColumns.filter((column) => column.table !== table)
    }
  })
  const allAddedColumns = addedColumns.filter(({ table }) => !createdTables.includes(table))

  const columnsByTable = pipe(
    groupBy(({ table }) => table),
    toPairs,
  )(allAddedColumns)
  const columnsPerTable = columnsByTable.map(([table, columnDefs]) => ({
    table: tableName(table),
    columns: unique(columnDefs.map(({ name }) => name)),
  }))

  return {
    from: fromVersion,
    tables: unique(createdTables),
    columns: columnsPerTable,
  }
}
