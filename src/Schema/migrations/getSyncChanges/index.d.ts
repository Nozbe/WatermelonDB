// @flow

import type { SchemaMigrations } from '../index'
import type { TableName, ColumnName, SchemaVersion } from '../../index'

import { $Exact } from '../../../types'

export type MigrationSyncChanges = $Exact<{
  from: SchemaVersion
  tables: TableName<any>[]
  columns: $Exact<{
    table: TableName<any>
    columns: ColumnName[]
  }>[]
}> | null

export default function getSyncChanges(
  migrations: SchemaMigrations,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
): MigrationSyncChanges
