// @flow

import { logError, invariant } from '../../utils/common'

import type { Model, Collection, Database } from '../..'
import { type RawRecord, type DirtyRaw, sanitizedRaw } from '../../RawRecord'
import type { SyncLog } from '../index'

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
  local._changed.split(',').forEach(column => {
    resolved[column] = local[column]
  })

  // Handle edge case
  if (local._status === 'created') {
    logError(
      `[Sync] Server wants client to update record ${
        local.id
      }, but it's marked as locally created. This is most likely either a server error or a Watermelon bug (please file an issue if it is!). Will assume it should have been 'synced', and just replace the raw`,
    )
    resolved._status = 'synced'
  }

  return resolved
}

function replaceRaw(record: Model, dirtyRaw: DirtyRaw): void {
  record._raw = sanitizedRaw(dirtyRaw, record.collection.schema)
}

export function prepareCreateFromRaw<T: Model>(collection: Collection<T>, dirtyRaw: DirtyRaw): T {
  return collection.prepareCreate(record => {
    replaceRaw(record, { ...dirtyRaw, _status: 'synced', _changed: '' })
  })
}

export function prepareUpdateFromRaw<T: Model>(
  record: T,
  updatedDirtyRaw: DirtyRaw,
  log: SyncLog,
): T {
  // Note COPY for log - only if needed
  const logConflict = !!record._raw._changed
  const logLocal = logConflict ? { ...record._raw } : {}
  const logRemote = logConflict ? { ...updatedDirtyRaw } : {}

  const newRaw = resolveConflict(record._raw, updatedDirtyRaw)
  return record.prepareUpdate(() => {
    replaceRaw(record, newRaw)

    // log resolved conflict - if any
    if (logConflict) {
      log.resolvedConflicts = log.resolvedConflicts || []
      log.resolvedConflicts.push({
        local: logLocal,
        remote: logRemote,
        resolved: { ...record._raw },
      })
    }
  })
}

export function prepareMarkAsSynced<T: Model>(record: T): T {
  const newRaw = { ...record._raw, _status: 'synced', _changed: '' }
  return record.prepareUpdate(() => {
    replaceRaw(record, newRaw)
  })
}

export function ensureActionsEnabled(database: Database): void {
  invariant(
    database._actionsEnabled,
    '[Sync] To use Sync, Actions must be enabled. Pass `{ actionsEnabled: true }` to Database constructor — see docs for more details',
  )
}

export function ensureSameDatabase(database: Database, initialResetCount: number): void {
  invariant(
    database._resetCount === initialResetCount,
    `[Sync] Sync aborted because database was reset`,
  )
}
