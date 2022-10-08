import type { Model, Collection, Database } from '../..'
import { type RawRecord, type DirtyRaw } from '../../RawRecord'
import type { SyncLog, SyncDatabaseChangeSet, SyncConflictResolver } from '../index'

export function resolveConflict(local: RawRecord, remote: DirtyRaw): DirtyRaw

export function prepareCreateFromRaw<T extends Model = Model>(collection: Collection<T>, dirtyRaw: DirtyRaw): T

export function prepareUpdateFromRaw<T = Model>(
  record: T,
  updatedDirtyRaw: DirtyRaw,
  log?: SyncLog,
  conflictResolver?: SyncConflictResolver,
): T

export function prepareMarkAsSynced<T = Model>(record: T): T

export function ensureSameDatabase(database: Database, initialResetCount: number): void

export const isChangeSetEmpty: (SyncDatabaseChangeSet) => boolean

export const changeSetCount: (SyncDatabaseChangeSet) => number
