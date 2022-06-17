import { $Exact } from '../../types'

import { type SchemaMigrations, type MigrationStep } from './index'
import { type SchemaVersion } from '../index'

export function stepsForMigration({
  migrations: schemaMigrations,
  fromVersion,
  toVersion,
}: $Exact<{
  migrations: SchemaMigrations,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
}>): MigrationStep[] | null
