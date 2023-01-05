// @flow

import { values } from '../../utils/fp'
import areRecordsEqual from '../../utils/fp/areRecordsEqual'
import { invariant } from '../../utils/common'

import type { Model, Collection, Database } from '../..'
import { type RawRecord, type DirtyRaw, sanitizedRaw } from '../../RawRecord'
import type { SyncLog, SyncDatabaseChangeSet, SyncConflictResolver } from '../index'

// Returns raw record with naive solution to a conflict based on local `_changed` field
// This is a per-column resolution algorithm. All columns that were changed locally win
// and will be applied on top of the remote version.
export function resolveConflict(local: RawRecord, remote: DirtyRaw): DirtyRaw {
  // We SHOULD NOT have a reference to a `deleted` record, but since it was locally
  // deleted, there's nothing to update, since the local deletion will still be pushed to the server -- return raw as is
  if (local._status === 'deleted') {
    return local
  }

  // mutating code - performance-critical path
  const resolved = {
    // use local fields if remote is missing columns (shouldn't but just in case)
    ...local,
    // Note: remote MUST NOT have a _status of _changed fields (will replace them anyway just in case)
    ...remote,
    id: local.id,
    _status: local._status,
    _changed: local._changed,
  }

  // Use local properties where changed
  local._changed.split(',').forEach((column) => {
    resolved[column] = local[column]
  })

  return resolved
}

function replaceRaw(record: Model, dirtyRaw: DirtyRaw): void {
  record._raw = sanitizedRaw(dirtyRaw, record.collection.schema)
}

export function prepareCreateFromRaw<T: Model>(collection: Collection<T>, dirtyRaw: DirtyRaw): T {
  // TODO: Think more deeply about this - it's probably unnecessary to do this check, since it would
  // mean malicious sync server, which is a bigger problem
  invariant(
    !Object.prototype.hasOwnProperty.call(dirtyRaw, '__proto__'),
    'Malicious dirtyRaw detected - contains a __proto__ key',
  )
  const raw = Object.assign({}, dirtyRaw, { _status: 'synced', _changed: '' }) // faster than object spread
  return collection.prepareCreateFromDirtyRaw(raw)
}

// optimization - don't run DB update if received record is the same as local
// (this happens a lot during replacement sync)
export function requiresUpdate<T: Model>(record: T, updatedDirtyRaw: DirtyRaw): boolean {
  const local = record._raw
  if (local._status !== 'synced') {
    return true
  }

  const remote = sanitizedRaw(updatedDirtyRaw, record.collection.schema)
  remote._status = 'synced'

  const canSkipSafely = areRecordsEqual(local, remote)
  return !canSkipSafely
}

export function prepareUpdateFromRaw<T: Model>(
  record: T,
  updatedDirtyRaw: DirtyRaw,
  log: ?SyncLog,
  conflictResolver?: SyncConflictResolver,
): ?T {
  if (!requiresUpdate(record, updatedDirtyRaw)) {
    return null
  }

  // Note COPY for log - only if needed
  const logConflict = log && !!record._raw._changed
  const logLocal = logConflict
    ? {
        // $FlowFixMe
        ...record._raw,
      }
    : {}
  const logRemote = logConflict ? { ...updatedDirtyRaw } : {}

  let newRaw = resolveConflict(record._raw, updatedDirtyRaw)

  if (conflictResolver) {
    newRaw = conflictResolver(record.table, record._raw, updatedDirtyRaw, newRaw)
  }

  // $FlowFixMe
  return record.prepareUpdate(() => {
    replaceRaw(record, newRaw)

    // log resolved conflict - if any
    if (logConflict && log) {
      log.resolvedConflicts = log.resolvedConflicts || []
      log.resolvedConflicts.push({
        local: logLocal,
        remote: logRemote,
        // $FlowFixMe
        resolved: { ...record._raw },
      })
    }
  })
}

export function prepareMarkAsSynced<T: Model>(record: T): T {
  const newRaw = Object.assign({}, record._raw, { _status: 'synced', _changed: '' }) // faster than object spread
  // $FlowFixMe
  return record.prepareUpdate(() => {
    replaceRaw(record, newRaw)
  })
}

export function ensureSameDatabase(database: Database, initialResetCount: number): void {
  invariant(
    database._resetCount === initialResetCount,
    `[Sync] Sync aborted because database was reset`,
  )
}

export const isChangeSetEmpty: (SyncDatabaseChangeSet) => boolean = (changeset) =>
  values(changeset).every(
    ({ created, updated, deleted }) => created.length + updated.length + deleted.length === 0,
  )

const sum: (number[]) => number = (xs) => xs.reduce((a, b) => a + b, 0)
export const changeSetCount: (SyncDatabaseChangeSet) => number = (changeset) =>
  sum(
    values(changeset).map(
      ({ created, updated, deleted }) => created.length + updated.length + deleted.length,
    ),
  )
