// @flow

import { sortBy, prop, pipe, map, last, head } from 'rambdax'
import { unnest } from '../../utils/fp'

import { type SchemaMigrations, type MigrationStep } from './index'
import { type SchemaVersion } from '../index'

const getAllSteps = pipe(
  sortBy(prop('version')),
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
}>): ?(MigrationStep[]) {
  const { migrations } = schemaMigrations
  const oldestMigration = last(migrations)
  const newestMigration = head(migrations)

  // no migrations
  if (!oldestMigration || !newestMigration) {
    return null
  }

  // out of range
  const minimumVersion = oldestMigration.version - 1
  const maximumVersion = newestMigration.version

  if (fromVersion < minimumVersion || toVersion > maximumVersion) {
    return null
  }

  // return steps
  const matchingMigrations = migrations.filter(
    ({ version }) => version > fromVersion && version <= toVersion,
  )

  return getAllSteps(matchingMigrations)
}
