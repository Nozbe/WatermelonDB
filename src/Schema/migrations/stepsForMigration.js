// @flow

import { unnest } from '../../utils/fp'

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
}>): ?(MigrationStep[]) {
  const { sortedMigrations, minVersion, maxVersion } = schemaMigrations

  // see if migrations in this range are available
  if (fromVersion < minVersion || toVersion > maxVersion) {
    return null
  }

  // return steps
  const matchingMigrations = sortedMigrations.filter(
    ({ toVersion: version }) => version > fromVersion && version <= toVersion,
  )

  const allSteps = unnest(matchingMigrations.map(migration => migration.steps))
  return allSteps
}
