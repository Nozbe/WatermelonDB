// @flow

import { sortBy, prop, pipe, map } from 'rambdax'
import { unnest } from '../../utils/fp'

import { type SchemaMigrations, type MigrationStep } from './index'
import { type SchemaVersion } from '../index'

const getAllSteps = pipe(
  sortBy(prop('from')),
  map(prop('steps')),
  unnest,
)

export function stepsForMigration({
  migrations: schemaMigrations,
  fromVersion,
  toVersion,
}: $Exact<{
  migrations: SchemaMigrations,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion,
}>): MigrationStep[] {
  const matchingMigrations = schemaMigrations.migrations.filter(
    migration => migration.from >= fromVersion && migration.to <= toVersion,
  )

  return getAllSteps(matchingMigrations)
}
