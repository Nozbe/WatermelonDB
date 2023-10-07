// @flow

import type { ColumnName, SchemaVersion, TableName } from '../../index'
import type { SchemaMigrations } from '../index'

import { $Exact } from '../../../types'

export type MigrationSyncChanges = $Exact<{
  from: SchemaVersion
  tables: Array<TableName<any>>
  columns: Array<$Exact<{
    table: TableName<any>
    columns: ColumnName[]
  }>>
}> | null

export default function getSyncChanges(
  migrations: SchemaMigrations,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
): MigrationSyncChanges
