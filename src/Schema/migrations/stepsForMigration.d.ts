import { $Exact } from '../../types'

import type { SchemaVersion } from '../index'
import type { MigrationStep, SchemaMigrations } from './index'

export function stepsForMigration({
  migrations: schemaMigrations,
  fromVersion,
  toVersion,
}: $Exact<{
  migrations: SchemaMigrations
  fromVersion: SchemaVersion
  toVersion: SchemaVersion
}>): MigrationStep[] | null
