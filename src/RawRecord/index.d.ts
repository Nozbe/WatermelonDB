import type { ColumnName, ColumnSchema, TableSchema } from '../Schema'
import type { RecordId, SyncStatus } from '../Model'


// Raw object representing a model record, coming from an untrusted source
// (disk, sync, user data). Before it can be used to create a Model instance
// it must be sanitized (with `sanitizedRaw`) into a RawRecord
export type DirtyRaw = { [key: string]: any }

// These fields are ALWAYS present in records of any collection.
type _RawRecord = {
  id: RecordId
  _status: SyncStatus
  _changed: string
}

// Raw object representing a model record. A RawRecord is guaranteed by the type system
// to be safe to use (sanitied with `sanitizedRaw`):
// - it has exactly the fields described by TableSchema (+ standard fields)
// - every field is exactly the type described by ColumnSchema (string, number, or boolean)
// - … and the same optionality (will not be null unless isOptional: true)
export type RawRecord = _RawRecord

// Transforms a dirty raw record object into a trusted sanitized RawRecord according to passed TableSchema
export function sanitizedRaw(dirtyRaw: DirtyRaw, tableSchema: TableSchema): RawRecord

// Modifies passed rawRecord by setting sanitized `value` to `columnName`
// Note: Assumes columnName exists and columnSchema matches the name
export function setRawSanitized(
  rawRecord: RawRecord,
  columnName: ColumnName,
  value: any,
  columnSchema: ColumnSchema,
): void

export type NullValue = null | '' | 0 | false

export function nullValue(columnSchema: ColumnSchema): NullValue
