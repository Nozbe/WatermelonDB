// @flow

import type { Database } from '../..'
import { invariant, logError, logger } from '../../utils/common'

import type { Timestamp, SyncLog } from '../index'
import type { SchemaVersion } from '../../Schema'
import getSyncChanges, { type MigrationSyncChanges } from '../../Schema/migrations/getSyncChanges'

export { default as applyRemoteChanges } from './applyRemote'
export { default as fetchLocalChanges, hasUnsyncedChanges } from './fetchLocal'
export { default as markLocalChangesAsSynced } from './markAsSynced'
import { ulid, decodeTime } from 'ulid'

const lastSequenceIdKey = '__watermelon_last_sequence_id'
const lastPulledAtKey = '__watermelon_last_pulled_at'
const lastPulledSchemaVersionKey = '__watermelon_last_pulled_schema_version'

export async function getLastPulledAt(database: Database, useSequenceIds = false): Promise<?Timestamp|?String> {
  const lastPulledAt = parseInt(await database.adapter.getLocal(lastPulledAtKey), 10) || null

  if (!useSequenceIds)
    return lastPulledAt

  const lastSequenceId = await getLastSequenceId(database)

  if (lastSequenceId)
    return lastSequenceId

  if (!lastPulledAt) 
    return null

  return ulid(lastPulledAt)
}

export async function setLastPulledAt(database: Database, timestamp: Timestamp|String, useSequenceIds = false): Promise<void> {
  const timeValue = useSequenceIds ? Math.floor(decodeTime(timestamp) / 1000) : timestamp

  await database.adapter.setLocal(lastPulledAtKey, `${timeValue}`)
  
  if (useSequenceIds) {
    await setLastSequenceId(database, timestamp)
  }
}

async function getLastSequenceId(database: Database): Promise<string> {
  return await database.adapter.getLocal(lastSequenceIdKey)
}

async function setLastSequenceId(database: Database, sequenceId: string): Promise<void> {
  await database.adapter.setLocal(lastSequenceIdKey, sequenceId)
}

export async function getLastPulledSchemaVersion(database: Database): Promise<?SchemaVersion> {
  return parseInt(await database.adapter.getLocal(lastPulledSchemaVersionKey), 10) || null
}

export async function setLastPulledSchemaVersion(
  database: Database,
  version: SchemaVersion,
): Promise<void> {
  await database.adapter.setLocal(lastPulledSchemaVersionKey, `${version}`)
}

type MigrationInfo = $Exact<{
  schemaVersion: SchemaVersion,
  migration: MigrationSyncChanges,
  shouldSaveSchemaVersion: boolean,
}>

export async function getMigrationInfo(
  database: Database,
  log: ?SyncLog,
  lastPulledAt: ?Timestamp,
  migrationsEnabledAtVersion: ?SchemaVersion,
): Promise<MigrationInfo> {
  const isFirstSync = !lastPulledAt
  const schemaVersion = database.schema.version

  const lastPulledSchemaVersion = await getLastPulledSchemaVersion(database)
  log && (log.lastPulledSchemaVersion = lastPulledSchemaVersion)

  const areMigrationsEnabled = !!migrationsEnabledAtVersion
  const { migrations } = database.adapter
  if (lastPulledSchemaVersion && isFirstSync) {
    logError(
      '[Sync] lastPulledSchemaVersion is set, but this is the first sync. This most likely means that the backend does not return a correct timestamp',
    )
  }
  if (areMigrationsEnabled) {
    invariant(
      typeof migrationsEnabledAtVersion === 'number' && migrationsEnabledAtVersion >= 1,
      '[Sync] Invalid migrationsEnabledAtVersion',
    )
    invariant(
      migrationsEnabledAtVersion <= schemaVersion,
      '[Sync] migrationsEnabledAtVersion must not be greater than current schema version',
    )
    invariant(
      migrations,
      '[Sync] Migration syncs cannot be enabled on a database that does not support migrations',
    )
    invariant(
      migrationsEnabledAtVersion >= migrations.minVersion,
      `[Sync] migrationsEnabledAtVersion is too low - not possible to migrate from schema version ${migrationsEnabledAtVersion}`,
    )
    lastPulledSchemaVersion &&
      invariant(
        lastPulledSchemaVersion <= schemaVersion,
        `[Sync] Last synced schema version (${lastPulledSchemaVersion}) is greater than current schema version (${schemaVersion}). This indicates programmer error`,
      )
  }

  const migrateFrom = lastPulledSchemaVersion || migrationsEnabledAtVersion || 0
  const shouldMigrate = areMigrationsEnabled && migrateFrom < schemaVersion && !isFirstSync
  const migration =
    migrations && shouldMigrate ? getSyncChanges(migrations, migrateFrom, schemaVersion) : null

  log && (log.migration = migration)

  if (migration) {
    logger.log(`[Sync] Performing migration sync from ${migrateFrom} to ${schemaVersion}`)
    if (!lastPulledSchemaVersion) {
      logger.warn(
        `[Sync] Using fallback initial schema version. The migration sync might not contain all necessary migrations`,
      )
    }
  }

  return {
    schemaVersion,
    migration,
    shouldSaveSchemaVersion: shouldMigrate || isFirstSync,
  }
}
