// @flow
/* eslint-disable no-lonely-if */
/* eslint-disable no-self-compare */

import {pickAll, values} from 'rambdax'
import { type ColumnName, type ColumnSchema, type TableSchema } from '../Schema'
import { type RecordId, type SyncStatus } from '../Model'
import { type Value } from '../QueryDescription'

import randomId from '../utils/common/randomId'
import identicalArrays from '../utils/fp/identicalArrays'

// Raw object representing a model record, coming from an untrusted source
// (disk, sync, user data). Before it can be used to create a Model instance
// it must be sanitized (with `sanitizedRaw`) into a RawRecord
export type DirtyRaw = Object

// These fields are ALWAYS present in records of any collection.
type _RawRecord = {
  id: RecordId,
  _status: SyncStatus,
  _changed: string,
}

// Raw object representing a model record. A RawRecord is guaranteed by the type system
// to be safe to use (sanitied with `sanitizedRaw`):
// - it has exactly the fields described by TableSchema (+ standard fields)
// - every field is exactly the type described by ColumnSchema (string, number, or boolean)
// - … and the same optionality (will not be null unless isOptional: true)
export opaque type RawRecord: _RawRecord = _RawRecord

export type RecordState = {
  id: RecordId,
  [field: ColumnName]: Value,
}

// a number, but not NaN (NaN !== NaN) or Infinity
function isValidNumber(value: any): boolean {
  return typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity
}

// Note: This is performance-critical code
function _setRaw(raw: Object, key: string, value: any, columnSchema: ColumnSchema): void {
  const { type, isOptional } = columnSchema

  // If the value is wrong type or invalid, it's set to `null` (if optional) or empty value ('', 0, false)
  if (type === 'string') {
    if (typeof value === 'string') {
      raw[key] = value
    } else {
      raw[key] = isOptional ? null : ''
    }
  } else if (type === 'boolean') {
    if (typeof value === 'boolean') {
      raw[key] = value
    } else if (value === 1 || value === 0) {
      // Exception to the standard rule — because SQLite turns true/false into 1/0
      raw[key] = Boolean(value)
    } else {
      raw[key] = isOptional ? null : false
    }
  } else {
    // type = number
    // Treat NaN and Infinity as null
    if (isValidNumber(value)) {
      raw[key] = value
    } else {
      raw[key] = isOptional ? null : 0
    }
  }
}

function isValidStatus(value: any): boolean {
  return value === 'created' || value === 'updated' || value === 'deleted' || value === 'synced'
}

// Transforms a dirty raw record object into a trusted sanitized RawRecord according to passed TableSchema
export function sanitizedRaw(dirtyRaw: DirtyRaw, tableSchema: TableSchema): RawRecord {
  const { id, _status, _changed } = dirtyRaw

  // This is called with `{}` when making a new record, so we need to set a new ID, status
  // Also: If an existing has one of those fields broken, we're screwed. Safest to treat it as a
  // new record (so that it gets synced)
  const raw = {}

  if (typeof id === 'string') {
    raw.id = id
    raw._status = isValidStatus(_status) ? _status : 'created'
    raw._changed = typeof _changed === 'string' ? _changed : ''
  } else {
    raw.id = randomId()
    raw._status = 'created'
    raw._changed = ''
  }

  // faster than Object.values on a map
  const columns = tableSchema.columnArray
  for (let i = 0, len = columns.length; i < len; i += 1) {
    const columnSchema = columns[i]
    const key = (columnSchema.name: string)
    const value = dirtyRaw[key]
    _setRaw(raw, key, value, columnSchema)
  }

  return raw
}

// Modifies passed rawRecord by setting sanitized `value` to `columnName`
// Note: Assumes columnName exists and columnSchema matches the name
export function setRawSanitized(
  rawRecord: RawRecord,
  columnName: ColumnName,
  value: any,
  columnSchema: ColumnSchema,
): void {
  _setRaw(rawRecord, columnName, value, columnSchema)
}

export type NullValue = null | '' | 0 | false

export function nullValue(columnSchema: ColumnSchema): NullValue {
  const { isOptional, type } = columnSchema
  if (isOptional) {
    return null
  } else if (type === 'string') {
    return ''
  } else if (type === 'number') {
    return 0
  } else if (type === 'boolean') {
    return false
  }

  throw new Error(`Unknown type for column schema ${JSON.stringify(columnSchema)}`)
}

export function getRecordState(rawRecord: RawRecord, columns: ColumnName[]): RecordState {
  // `pickAll` guarantees same length and order of keys!
  // $FlowFixMe
  return pickAll(columns, rawRecord)
}

// Invariant: same length and order of keys!
export function recordStatesEqual(left: RecordState, right: RecordState): boolean {
  return identicalArrays(values(left), values(right))
}
