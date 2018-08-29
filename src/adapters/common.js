// @flow

import type { RecordId } from 'Model'
import type { TableSchema } from 'Schema'
import type { CachedQueryResult, CachedFindResult } from 'adapters/type'
import { sanitizedRaw, type DirtyRaw } from 'RawRecord'

export type DirtyFindResult = RecordId | ?DirtyRaw
export type DirtyQueryResult = Array<RecordId | DirtyRaw>

export function sanitizeFindResult(
  dirtyRecord: DirtyFindResult,
  tableSchema: TableSchema,
): CachedFindResult {
  return dirtyRecord && typeof dirtyRecord === 'object' ?
    sanitizedRaw(dirtyRecord, tableSchema) :
    dirtyRecord
}

export function sanitizeQueryResult(
  dirtyRecords: DirtyQueryResult,
  tableSchema: TableSchema,
): CachedQueryResult {
  return dirtyRecords.map(
    dirtyRecord =>
      typeof dirtyRecord === 'string' ? dirtyRecord : sanitizedRaw(dirtyRecord, tableSchema),
  )
}
