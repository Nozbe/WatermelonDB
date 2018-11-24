// @flow

import type { Model, Collection } from '..'
import { type RawRecord, type DirtyRaw, sanitizedRaw } from '../RawRecord'

// Returns raw record with naive solution to a conflict based on local `_changed` field
// This is a per-column resolution algorithm. All columns that were changed locally win
// and will be applied on top of the remote version.
export function resolveConflict(local: RawRecord, remote: DirtyRaw): DirtyRaw {
  // mutating code - performance-critical path
  const resolved = {
    ...remote,
    _status: local._status,
    // TODO: in Purple code resolution changes _changed to null, but is that right? i think until local changes are pushed, local changes are NOT synced. if pull succeeded, but push failed, this param change would get lost
    _changed: local._changed,
  }
  // TODO: Doesn't raw sanitization prohibit null? (if so, also change addToRawSet; if not, add test)
  const localChanges = (local._changed || '').split(',')

  localChanges.forEach(column => {
    resolved[column] = local[column]
  })

  // TODO: What about last_modified?
  return resolved
}

function replaceRaw(record: Model, dirtyRaw: DirtyRaw): void {
  record._raw = sanitizedRaw(dirtyRaw, record.collection.schema)
}

export function prepareCreateFromRaw<T: Model>(collection: Collection<T>, dirtyRaw: DirtyRaw): T {
  return collection.prepareCreate(record => {
    replaceRaw(record, dirtyRaw)
  })
}

export function markAsSynced(record: Model): void {
  record._raw._status = 'synced'
  record._raw._changed = ''
}
