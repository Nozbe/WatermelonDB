// @flow
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

  const createdTables: Set<TableName<any>> = new Set()
  const createdColumns: Map<string, Set<ColumnName>> = new Map()

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

    if (step.type === 'create_table') {
      createdTables.add(step.schema.name)
    } else if (step.type === 'add_columns') {
      if (createdTables.has(step.table)) {
        return
      }
      const columns = createdColumns.get(step.table) || new Set()
      step.columns.forEach((column) => {
        columns.add(column.name)
      })
      createdColumns.set(step.table, columns)
    } else if (step.type === 'destroy_table') {
      createdTables.delete(step.table)
      createdColumns.delete(step.table)
    } else if (step.type === 'destroy_column') {
      const columns = createdColumns.get(step.table)
      if (columns) {
        columns.delete(step.column)
      }
    } else if (step.type === 'rename_column') {
      const columns = createdColumns.get(step.table)
      if (columns && columns.has(step.from)) {
        columns.delete(step.from)
        columns.add(step.to)
      }
    }
  })

  const columnsByTable = Array.from(createdColumns.entries()).map(([table, columns]) => ({
    table: tableName(table),
    columns: Array.from(columns),
  }))

  return {
    from: fromVersion,
    tables: Array.from(createdTables),
    columns: columnsByTable,
  }
}
