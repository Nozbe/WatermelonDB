// @flow

import type { Model, Collection } from '..'
import { type RawRecord, type DirtyRaw, sanitizedRaw } from '../RawRecord'

// Returns raw record with naive solution to a conflict based on local `_changed` field
// This is a per-column resolution algorithm. All columns that were changed locally win
// and will be applied on top of the remote version.
export function resolveConflict(local: RawRecord, remote: DirtyRaw): DirtyRaw {
  // mutating code - performance-critical path
  const resolved = {
    // use local fields if remote is missing columns (shouldn't but just in case)
    ...local,
    // Note: remote MUST NOT have a _status of _changed fields
    // TODO: in Purple code resolution changes _changed to null, but is that right? i think until local changes are pushed, local changes are NOT synced. if pull succeeded, but push failed, this param change would get lost
    ...remote,
  }

  // Use local properties where changed
  // TODO: Doesn't raw sanitization prohibit null? (if so, also change addToRawSet; if not, add test)
  const localChanges = (local._changed || '').split(',')

  localChanges.forEach(column => {
    resolved[column] = local[column]
  })

  // This is a programmer error - we have a record that was remotely UPDATED, but
  // it's marked as 'locally created'. We'll assume it should have been `synced`, and just replace the raw
  if (local._status === 'created') {
    // TODO: Log error
    resolved._status = 'synced'
  }

  // TODO: What about last_modified?
  return resolved
}

function replaceRaw(record: Model, dirtyRaw: DirtyRaw): void {
  record._raw = sanitizedRaw(dirtyRaw, record.collection.schema)
}

export function prepareCreateFromRaw<T: Model>(collection: Collection<T>, dirtyRaw: DirtyRaw): T {
  return collection.prepareCreate(record => {
    replaceRaw(record, { _status: 'synced', ...dirtyRaw })
  })
}

export function prepareUpdateFromRaw<T: Model>(record: T, updatedDirtyRaw: DirtyRaw): T {
  return record.prepareUpdate(() => {
    const { syncStatus } = record
    if (syncStatus !== 'deleted') {
      replaceRaw(record, resolveConflict(record._raw, updatedDirtyRaw))
    } else {
      // We SHOULD NOT have a reference to a `deleted` record, but since it was locally
      // deleted, there's nothing to update, since the local deletion will still be pushed to the server
    }
  })
}

export function markAsSynced(record: Model): void {
  record._raw._status = 'synced'
  record._raw._changed = ''
}
