import {$Exact} from '../../types'
import type { Database } from '../..'

import type { Timestamp, SyncLog } from '../index'
import type { SchemaVersion } from '../../Schema'
import { type MigrationSyncChanges } from '../../Schema/migrations/getSyncChanges'

export { default as applyRemoteChanges } from './applyRemote'
export { default as fetchLocalChanges, hasUnsyncedChanges } from './fetchLocal'
export { default as markLocalChangesAsSynced } from './markAsSynced'

export function getLastPulledAt(database: Database): Promise<Timestamp | null>

export function setLastPulledAt(database: Database, timestamp: Timestamp): Promise<void>

export function getLastPulledSchemaVersion(database: Database): Promise<SchemaVersion | null>

export function setLastPulledSchemaVersion(
  database: Database,
  version: SchemaVersion,
): Promise<void>

type MigrationInfo = $Exact<{
  schemaVersion: SchemaVersion,
  migration: MigrationSyncChanges,
  shouldSaveSchemaVersion: boolean,
}>

export function getMigrationInfo(
  database: Database,
  log?: SyncLog,
  lastPulledAt?: Timestamp,
  migrationsEnabledAtVersion?: SchemaVersion,
): Promise<MigrationInfo>
