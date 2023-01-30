import type { Model, Collection, Database } from '../..'
import type { RawRecord, DirtyRaw } from '../../RawRecord'
import type { SyncLog, SyncDatabaseChangeSet, SyncConflictResolver } from '../index'

// Returns raw record with naive solution to a conflict based on local `_changed` field
// This is a per-column resolution algorithm. All columns that were changed locally win
// and will be applied on top of the remote version.
export function resolveConflict(local: RawRecord, remote: DirtyRaw): DirtyRaw

export function prepareCreateFromRaw<T extends Model = Model>(
  collection: Collection<T>,
  dirtyRaw: DirtyRaw,
): T

export function prepareUpdateFromRaw<T extends Model = Model>(
  record: T,
  updatedDirtyRaw: DirtyRaw,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
): T

export function prepareMarkAsSynced<T extends Model = Model>(record: T): T

export function ensureSameDatabase(database: Database, initialResetCount: number): void

export const isChangeSetEmpty: (_: SyncDatabaseChangeSet) => boolean

export const changeSetCount: (_: SyncDatabaseChangeSet) => number
