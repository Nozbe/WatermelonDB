import { prop, pipe, map } from 'rambdax'
import { unnest } from '../../utils/fp'

import { SchemaMigrations, MigrationStep } from './index'
import { SchemaVersion } from '../index'

const getAllSteps = pipe(
  map(prop('steps')),
  unnest,
)

export function stepsForMigration({
  migrations: schemaMigrations,
  fromVersion,
  toVersion,
}: {
  migrations: SchemaMigrations
  fromVersion: SchemaVersion
  toVersion: SchemaVersion
}): MigrationStep[] | null | undefined {
  const { sortedMigrations, minVersion, maxVersion } = schemaMigrations

  // see if migrations in this range are available
  if (fromVersion < minVersion || toVersion > maxVersion) {
    return null
  }

  // return steps
  const matchingMigrations = sortedMigrations.filter(
    ({ toVersion: version }) => version > fromVersion && version <= toVersion,
  )

  return getAllSteps(matchingMigrations) as MigrationStep[] | null | undefined
}
